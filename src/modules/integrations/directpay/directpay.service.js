import crypto from "node:crypto";
import { Op } from "sequelize";
import { db } from "../../../models/index.js";
import { ApiError } from "../../../core/errors.js";
import { grantOrderEntitlements } from "../../commerce/commerce.service.js";
import { assertDirectPayConfig, getDirectPayConfig } from "./directpay.config.js";
import { parseConfirmationPayload } from "./directpay.validation.js";

const activeStatuses = ["created", "initiation_pending", "initiated", "customer_action_required", "processing"];
const money = (value) => { const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(value ?? "").trim()); return match ? `${match[1]}.${(match[2] || "").padEnd(2, "0")}` : null; };
const safeMessage = (value) => String(value || "").slice(0, 240);
const reference = () => `DP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(5).toString("hex").toUpperCase()}`.slice(0, 20);
const eventHash = (data) => crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");

export const normalizeDirectPaySriLankanMobile = (value) => {
  const compact = String(value || "").trim().replace(/[\s()-]/g, "");
  const local = compact.replace(/^\+/, "");
  const national = /^0(7\d{8})$/.exec(local)?.[1] || /^94(7\d{8})$/.exec(local)?.[1];
  if (!national) return null;
  return `+94${national}`;
};

export const directPayHealth = (config = getDirectPayConfig()) => !config.enabled
  ? { status: "disabled", environment: config.environment, enabled: false }
  : config.merchantId ? { status: "ready", environment: config.environment, enabled: true } : { status: "incomplete", environment: config.environment, enabled: true, missing: ["DIRECTPAY_MERCHANT_ID"] };

export const initiateDirectPay = async (userId, orderId, idempotencyKey, config = getDirectPayConfig()) => {
  assertDirectPayConfig(config);
  return db.sequelize.transaction(async (transaction) => {
    const order = await db.Order.findOne({ where: { id: orderId, userId }, include: [db.OrderItem, { model: db.User, include: [db.StudentProfile] }], transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw new ApiError(404, "Order not found");
    if (!["payment_pending", "pending", "awaiting_payment"].includes(order.status) || !["unpaid", "pending"].includes(order.paymentStatus) || (order.expiresAt && new Date(order.expiresAt) <= new Date())) throw new ApiError(409, "Order is not eligible for payment");
    const amount = money(order.total);
    if (order.currency !== "LKR" || !amount) throw new ApiError(422, "Only valid LKR orders can be paid with DirectPay");
    const customerMobile = normalizeDirectPaySriLankanMobile(order.User?.StudentProfile?.mobileNumber || order.User?.StudentProfile?.whatsAppNumber);
    if (!customerMobile) throw new ApiError(422, "Please add a valid Sri Lankan mobile number to your profile before making a card payment.");
    let payment = await db.PaymentTransaction.findOne({ where: { orderId, provider: "directpay", status: { [Op.in]: activeStatuses } }, transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) payment = await db.PaymentTransaction.create({ orderId, provider: "directpay", merchantReference: reference(), idempotencyKey: `${order.id}:${idempotencyKey}`, status: "customer_action_required", currency: order.currency, amount, requestAmount: amount, initiatedAt: new Date() }, { transaction });
    const description = (order.OrderItems || []).map((item) => item.productNameSnapshot || item.name).filter(Boolean).join(", ").slice(0, 100) || `A Plus ICT order ${order.orderNumber}`;
    return { payment, checkout: { merchantId: config.merchantId, reference: payment.merchantReference, amount, currency: order.currency, description, customerEmail: order.User?.email || "", customerMobile } };
  });
};

export const handleDirectPayConfirmation = async (payload) => {
  const details = parseConfirmationPayload(payload);
  const payment = await db.PaymentTransaction.findOne({ where: { merchantReference: details.reference, provider: "directpay" } });
  const hash = eventHash(details);
  const existing = await db.PaymentProviderEvent.findOne({ where: { payloadHash: hash } });
  if (existing?.processed) return { received: true, duplicate: true };
  const event = existing || await db.PaymentProviderEvent.create({ provider: "directpay", providerEventId: details.transactionId, paymentTransactionId: payment?.id || null, orderId: payment?.orderId || null, eventType: "ONE_TIME", eventStatus: details.status, payloadHash: hash, signatureValid: null });
  if (!payment) { await event.update({ processed: true, processedAt: new Date(), processingError: "Unknown merchant reference" }); throw new ApiError(404, "DirectPay transaction was not found"); }
  try {
    const result = details.status === "SUCCESS" ? await completePayment(payment.id, details) : await recordNonSuccess(payment.id, details);
    await event.update({ processed: true, processedAt: new Date() });
    return { received: true, duplicate: !!result.idempotent };
  } catch (error) { await event.update({ processed: true, processedAt: new Date(), processingError: safeMessage(error.message) }); throw error; }
};

const completePayment = (paymentId, details) => db.sequelize.transaction(async (transaction) => {
  const payment = await db.PaymentTransaction.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
  const order = await db.Order.findByPk(payment.orderId, { transaction, lock: transaction.LOCK.UPDATE });
  if (payment.status === "completed" && order.paymentStatus === "verified") return { payment, idempotent: true };
  const expected = money(order.total), received = money(details.amount);
  if (!received || received !== expected || details.currency !== order.currency) { await payment.update({ status: "amount_mismatch", providerStatusMessage: "Provider financial fields did not match the order", verificationSource: "directpay_confirmation" }, { transaction }); throw new ApiError(409, "Payment verification failed"); }
  if (["failed", "cancelled", "expired", "verification_failed", "amount_mismatch"].includes(payment.status)) throw new ApiError(409, "Payment transaction cannot be completed");
  await payment.update({ status: "completed", providerTransactionId: details.transactionId, providerReference: details.reference, providerStatusCode: details.status, providerStatusMessage: safeMessage(details.description), verifiedAmount: received, verifiedAt: new Date(), completedAt: new Date(), verificationSource: "directpay_confirmation" }, { transaction });
  const fromStatus = order.status;
  await order.update({ status: "completed", paymentStatus: "verified", paymentMethod: "directpay", completedAt: new Date() }, { transaction });
  await grantOrderEntitlements(order, null, transaction);
  await db.OrderStatusHistory.create({ orderId: order.id, fromStatus, toStatus: "completed", paymentStatus: "verified", reason: "directpay_confirmation", actorUserId: null }, { transaction });
  return { payment, idempotent: false };
});

const recordNonSuccess = (paymentId, details) => db.sequelize.transaction(async (transaction) => {
  const payment = await db.PaymentTransaction.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
  if (payment.status === "completed") return { payment, idempotent: true };
  const status = details.status === "CANCELLED" || details.status === "CANCELED" ? "cancelled" : "failed";
  await payment.update({ status, providerTransactionId: details.transactionId, providerReference: details.reference, providerStatusCode: details.status, providerStatusMessage: safeMessage(details.description), [status === "failed" ? "failedAt" : "cancelledAt"]: new Date(), verificationSource: "directpay_confirmation" }, { transaction });
  return { payment, idempotent: false };
});

export const studentPaymentStatus = async (userId, orderId) => {
  const payment = await db.PaymentTransaction.findOne({ include: [{ model: db.Order, where: { id: orderId, userId } }], where: { provider: "directpay" }, order: [["createdAt", "DESC"]] });
  if (!payment) throw new ApiError(404, "DirectPay payment not found");
  return { id: payment.id, orderId, status: payment.status, amount: payment.amount, currency: payment.currency, providerReference: payment.providerReference, nextPollAfterMs: ["processing", "customer_action_required", "initiated"].includes(payment.status) ? 3000 : null, entitlementActive: payment.status === "completed" };
};
