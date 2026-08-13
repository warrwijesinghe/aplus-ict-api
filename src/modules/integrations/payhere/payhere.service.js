import crypto from "node:crypto";
import { Op } from "sequelize";
import { db } from "../../../models/index.js";
import { ApiError } from "../../../core/errors.js";
import { grantOrderEntitlements } from "../../commerce/commerce.service.js";
import { assertPayHereConfig, getPayHereConfig } from "./payhere.config.js";

const activeStatuses = ["created", "initiation_pending", "initiated", "customer_action_required", "processing"];
const safeMessage = (value) => String(value || "").slice(0, 240);
const md5 = (value) => crypto.createHash("md5").update(String(value)).digest("hex").toUpperCase();
const eventHash = (data) => crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
const reference = () => `PH${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString("hex").toUpperCase()}`.slice(0, 20);

export const formatPayHereAmount = (value) => {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(value ?? "").trim());
  return match ? `${match[1]}.${(match[2] || "").padEnd(2, "0")}` : null;
};
export const normalizePayHerePhone = (value) => {
  const compact = String(value || "").trim().replace(/[\s()-]/g, "");
  const local = compact.replace(/^\+/, "");
  const national = /^0(7\d{8})$/.exec(local)?.[1] || /^94(7\d{8})$/.exec(local)?.[1];
  return national ? `94${national}` : null;
};
export const payHereHash = ({ merchantId, orderId, amount, currency, merchantSecret }) =>
  md5(`${merchantId}${orderId}${amount}${currency}${md5(merchantSecret)}`);
export const payHereNotificationSignature = ({ merchantId, orderId, amount, currency, statusCode, merchantSecret }) =>
  md5(`${merchantId}${orderId}${amount}${currency}${statusCode}${md5(merchantSecret)}`);
export const mapPayHereStatus = (statusCode) => ({ "2": "completed", "0": "processing", "-1": "cancelled", "-2": "failed", "-3": "failed" }[String(statusCode)] || "failed");
const sameSecret = (actual, expected) => {
  const left = Buffer.from(String(actual || "").toUpperCase()); const right = Buffer.from(String(expected || "").toUpperCase());
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const customer = (user) => {
  const profile = user?.StudentProfile;
  const fullName = String(profile?.fullName || user?.name || "").trim();
  const [firstName, ...last] = fullName.split(/\s+/).filter(Boolean);
  const phone = normalizePayHerePhone(profile?.mobileNumber || profile?.whatsAppNumber);
  const missing = [[firstName, "name"], [user?.email, "email"], [phone, "mobile number"], [profile?.address, "address"], [profile?.city, "city"]].filter(([value]) => !value).map(([, field]) => field);
  if (missing.length) throw new ApiError(422, `Complete your student profile before paying with PayHere: ${missing.join(", ")}.`, { code: "PAYHERE_PROFILE_INCOMPLETE", fields: missing });
  return { first_name: firstName, last_name: last.join(" ") || firstName, email: user.email, phone, address: String(profile.address).trim(), city: String(profile.city).trim(), country: "Sri Lanka" };
};

export const initiatePayHere = async (userId, orderId, idempotencyKey, config = getPayHereConfig()) => {
  assertPayHereConfig(config);
  return db.sequelize.transaction(async (transaction) => {
    const order = await db.Order.findOne({ where: { id: orderId, userId }, include: [db.OrderItem, { model: db.User, include: [db.StudentProfile] }], transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw new ApiError(404, "Order not found");
    if (!["payment_pending", "pending", "awaiting_payment"].includes(order.status) || !["unpaid", "pending"].includes(order.paymentStatus) || (order.expiresAt && new Date(order.expiresAt) <= new Date())) throw new ApiError(409, "Order is not eligible for payment");
    const amount = formatPayHereAmount(order.total);
    if (order.currency !== "LKR" || !amount) throw new ApiError(422, "Only valid LKR orders can be paid with PayHere");
    const details = customer(order.User);
    let payment = await db.PaymentTransaction.findOne({ where: { orderId, provider: "payhere", status: { [Op.in]: activeStatuses } }, transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) payment = await db.PaymentTransaction.create({ orderId, provider: "payhere", merchantReference: reference(), idempotencyKey: `${order.id}:${idempotencyKey}`, status: "customer_action_required", currency: order.currency, amount, requestAmount: amount, initiatedAt: new Date() }, { transaction });
    const items = (order.OrderItems || []).map((item) => item.productNameSnapshot || item.name).filter(Boolean).join(", ").slice(0, 100) || `A Plus ICT order ${order.orderNumber}`;
    return { payment, checkout: { sandbox: config.sandbox, merchant_id: config.merchantId, notify_url: config.notifyUrl, order_id: payment.merchantReference, items, amount, currency: order.currency, hash: payHereHash({ merchantId: config.merchantId, orderId: payment.merchantReference, amount, currency: order.currency, merchantSecret: config.merchantSecret }), ...details } };
  });
};

const completePayment = (paymentId, details) => db.sequelize.transaction(async (transaction) => {
  const payment = await db.PaymentTransaction.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
  const order = await db.Order.findByPk(payment.orderId, { transaction, lock: transaction.LOCK.UPDATE });
  if (payment.status === "completed" && order.paymentStatus === "verified") return { payment, idempotent: true };
  const expected = formatPayHereAmount(order.total);
  if (details.amount !== expected || details.currency !== order.currency) { await payment.update({ status: "amount_mismatch", providerStatusMessage: "Provider financial fields did not match the order", verificationSource: "payhere_notify" }, { transaction }); throw new ApiError(409, "Payment verification failed"); }
  if (["failed", "cancelled", "expired", "verification_failed", "amount_mismatch"].includes(payment.status)) throw new ApiError(409, "Payment transaction cannot be completed");
  await payment.update({ status: "completed", providerTransactionId: details.paymentId, providerReference: details.reference, providerStatusCode: details.statusCode, providerStatusMessage: safeMessage(details.statusMessage), paymentMethod: details.method || "payhere", verifiedAmount: details.amount, verifiedAt: new Date(), completedAt: new Date(), verificationSource: "payhere_notify" }, { transaction });
  const fromStatus = order.status;
  await order.update({ status: "completed", paymentStatus: "verified", paymentMethod: "payhere", completedAt: new Date() }, { transaction });
  await grantOrderEntitlements(order, null, transaction);
  await db.OrderStatusHistory.create({ orderId: order.id, fromStatus, toStatus: "completed", paymentStatus: "verified", reason: "payhere_notify", actorUserId: null }, { transaction });
  return { payment, idempotent: false };
});
const recordNonSuccess = (paymentId, details) => db.sequelize.transaction(async (transaction) => {
  const payment = await db.PaymentTransaction.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
  if (payment.status === "completed") return { payment, idempotent: true };
  const status = mapPayHereStatus(details.statusCode);
  await payment.update({ status, providerTransactionId: details.paymentId, providerReference: details.reference, providerStatusCode: details.statusCode, providerStatusMessage: safeMessage(details.statusMessage), [status === "cancelled" ? "cancelledAt" : "failedAt"]: new Date(), verificationSource: "payhere_notify" }, { transaction });
  return { payment, idempotent: false };
});

export const handlePayHereNotification = async (payload, config = getPayHereConfig()) => {
  const details = { merchantId: String(payload.merchant_id || ""), reference: String(payload.order_id || ""), paymentId: String(payload.payment_id || ""), amount: formatPayHereAmount(payload.payhere_amount), currency: String(payload.payhere_currency || ""), statusCode: String(payload.status_code || ""), signature: String(payload.md5sig || ""), method: String(payload.method || ""), statusMessage: String(payload.status_message || "") };
  const hash = eventHash({ ...details, signature: undefined });
  if (!details.merchantId || !details.reference || !details.amount || !details.currency || !["2", "0", "-1", "-2", "-3"].includes(details.statusCode)) throw new ApiError(422, "Invalid PayHere notification");
  const expectedSignature = payHereNotificationSignature({ merchantId: details.merchantId, orderId: details.reference, amount: details.amount, currency: details.currency, statusCode: details.statusCode, merchantSecret: config.merchantSecret });
  const signatureValid = details.merchantId === config.merchantId && sameSecret(details.signature, expectedSignature);
  if (!signatureValid) { console.warn("[payhere] rejected notification: merchant or signature mismatch"); throw new ApiError(400, "Invalid PayHere notification"); }
  const existing = await db.PaymentProviderEvent.findOne({ where: { payloadHash: hash } });
  if (existing?.processed) return { received: true, duplicate: true };
  const payment = await db.PaymentTransaction.findOne({ where: { merchantReference: details.reference, provider: "payhere" } });
  const event = existing || await db.PaymentProviderEvent.create({ provider: "payhere", providerEventId: details.paymentId || null, paymentTransactionId: payment?.id || null, orderId: payment?.orderId || null, eventType: "PAYHERE_NOTIFY", eventStatus: details.statusCode, payloadHash: hash, signatureValid: true });
  if (!payment) { await event.update({ processed: true, processedAt: new Date(), processingError: "Unknown merchant reference" }); throw new ApiError(404, "PayHere payment was not found"); }
  try { const result = details.statusCode === "2" ? await completePayment(payment.id, details) : await recordNonSuccess(payment.id, details); await event.update({ processed: true, processedAt: new Date() }); return { received: true, duplicate: !!result.idempotent }; }
  catch (error) { await event.update({ processed: true, processedAt: new Date(), processingError: safeMessage(error.message) }); throw error; }
};
export const studentPayHerePaymentStatus = async (userId, orderId) => {
  const payment = await db.PaymentTransaction.findOne({ include: [{ model: db.Order, where: { id: orderId, userId } }], where: { provider: "payhere" }, order: [["createdAt", "DESC"]] });
  if (!payment) throw new ApiError(404, "PayHere payment not found");
  return { id: payment.id, orderId, status: payment.status, amount: payment.amount, currency: payment.currency, providerReference: payment.providerReference, nextPollAfterMs: ["processing", "customer_action_required", "initiated"].includes(payment.status) ? 3000 : null, entitlementActive: payment.status === "completed" };
};
