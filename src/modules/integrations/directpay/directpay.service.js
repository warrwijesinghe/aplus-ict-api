import crypto from "node:crypto";
import { Op } from "sequelize";
import { db } from "../../../models/index.js";
import { ApiError } from "../../../core/errors.js";
import { grantOrderEntitlements } from "../../commerce/commerce.service.js";
import { assertDirectPayConfig, getDirectPayConfig, readConfiguredKey } from "./directpay.config.js";
import { browserSigningPayload, responseSigningPayload, signPayload, statusSigningPayload, verifyPayload } from "./directpay.signature.js";
import { validateResponsePayload } from "./directpay.validation.js";

const money = (value) => { const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(value ?? "").trim()); if (!match) return null; return `${match[1]}.${(match[2] || "").padEnd(2, "0")}`; };
const safeMessage = (value) => String(value || "").slice(0, 240);
const providerStatus = (value) => ({ SUCCESS: "success", FAILED: "failed", CANCELLED: "cancelled", CANCELED: "cancelled", PENDING: "pending", PROCESSING: "pending" }[String(value || "").toUpperCase()] || "pending");
const eventHash = (payload) => crypto.createHash("sha256").update(JSON.stringify({ orderId: payload.orderId, trnId: payload.trnId, status: payload.status, desc: payload.desc, signature: payload.signature })).digest("hex");
const activeStatuses = ["created", "initiation_pending", "initiated", "customer_action_required", "processing"];

export const directPayHealth = (config = getDirectPayConfig()) => {
  if (!config.enabled) return { status: "disabled", environment: config.environment, enabled: false };
  try { assertDirectPayConfig(config); return { status: "ready", environment: config.environment, enabled: true, merchantLegalName: config.merchantLegalName }; }
  catch (error) { return { status: "incomplete", environment: config.environment, enabled: true, missing: error.details?.missing || ["configuration"] }; }
};

const checkoutRequest = ({ transaction, order, user }, config) => {
  const [firstName = "Student", ...rest] = String(user.name || "Student").trim().split(/\s+/);
  const request = { merchantId: config.merchantId, amount: money(order.total), currency: order.currency, pluginName: "CUSTOM", pluginVersion: "1.0", returnUrl: `${config.returnUrl}?orderId=${encodeURIComponent(order.id)}`, cancelUrl: `${config.cancelUrl}?orderId=${encodeURIComponent(order.id)}`, orderId: transaction.merchantReference, reference: transaction.merchantReference, firstName, lastName: rest.join(" "), email: user.email || "", description: `A Plus ICT · ${order.orderNumber}`, apiKey: config.apiKey, responseUrl: config.responseUrl };
  return { ...request, signature: signPayload(browserSigningPayload(request), readConfiguredKey(config.privateKeyPath)) };
};
const publicCheckoutFields = (request) => ({ _type: "ONE_TIME", _mId: request.merchantId, _amount: request.amount, _currency: request.currency, _firstName: request.firstName, _lastName: request.lastName, _email: request.email, _reference: request.reference, _description: request.description, _returnUrl: request.returnUrl, _cancelUrl: request.cancelUrl, _responseUrl: request.responseUrl, _orderId: request.orderId, _pluginVersion: request.pluginVersion, _pluginName: request.pluginName, api_key: request.apiKey, signature: request.signature });

export const initiateDirectPay = async (userId, orderId, idempotencyKey = crypto.randomUUID(), config = getDirectPayConfig()) => {
  assertDirectPayConfig(config);
  return db.sequelize.transaction(async (transaction) => {
    const order = await db.Order.findOne({ where: { id: orderId, userId }, include: [db.OrderItem, db.User], transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw new ApiError(404, "Order not found");
    if (!["payment_pending", "pending", "awaiting_payment"].includes(order.status) || !["unpaid", "pending"].includes(order.paymentStatus) || order.expiresAt && new Date(order.expiresAt) <= new Date()) throw new ApiError(409, "Order is not eligible for payment");
    if (order.currency !== "LKR" || !money(order.total)) throw new ApiError(422, "Only valid LKR Orders can be paid with DirectPay");
    if (await db.Entitlement.findOne({ where: { userId, sourceType: "order", sourceId: order.id, status: "active" }, transaction })) throw new ApiError(409, "This Order already has an active entitlement");
    let payment = await db.PaymentTransaction.findOne({ where: { orderId, provider: "directpay", status: { [Op.in]: activeStatuses } }, transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) payment = await db.PaymentTransaction.create({ orderId, provider: "directpay", merchantReference: `APLDP-${order.orderNumber}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`, idempotencyKey: `${order.id}:${idempotencyKey}`, status: "initiation_pending", currency: order.currency, amount: money(order.total), requestAmount: money(order.total) }, { transaction });
    const request = checkoutRequest({ transaction: payment, order, user: order.User }, config);
    await payment.update({ status: "customer_action_required", initiatedAt: payment.initiatedAt || new Date() }, { transaction });
    return { payment, checkout: { action: config.checkoutUrl, method: "POST", fields: publicCheckoutFields(request), merchantLegalName: config.merchantLegalName } };
  });
};

const markProviderState = async (payment, state, details, source, transaction) => {
  const update = { providerTransactionId: String(details.trnId || details.transactionId || payment.providerTransactionId || "") || null, providerReference: String(details.orderId || payment.providerReference || "") || null, providerStatusCode: String(details.status || payment.providerStatusCode || ""), providerStatusMessage: safeMessage(details.desc || details.bankerResponseDesc), lastStatusCheckedAt: source === "directpay_status_check" ? new Date() : payment.lastStatusCheckedAt, verificationSource: source };
  if (state === "failed") Object.assign(update, { status: "failed", failedAt: new Date() });
  if (state === "cancelled") Object.assign(update, { status: "cancelled", cancelledAt: new Date() });
  if (state === "pending") update.status = "processing";
  await payment.update(update, { transaction }); return payment;
};

export const processVerifiedPayment = async (paymentId, details, source) => db.sequelize.transaction(async (transaction) => {
  const payment = await db.PaymentTransaction.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE }); if (!payment) throw new ApiError(404, "Payment transaction not found");
  const order = await db.Order.findByPk(payment.orderId, { transaction, lock: transaction.LOCK.UPDATE });
  if (payment.status === "completed" && order.paymentStatus === "verified") return { payment, order, idempotent: true };
  const verifiedAmount = money(details.amount); const expected = money(order.total);
  if (!verifiedAmount || verifiedAmount !== expected || details.currency !== order.currency || details.orderId !== payment.merchantReference) { await payment.update({ status: "amount_mismatch", verificationSource: source, providerStatusMessage: "Provider response did not match Order financial fields" }, { transaction }); throw new ApiError(409, "Payment verification failed"); }
  if (["failed", "cancelled", "expired", "verification_failed", "amount_mismatch"].includes(payment.status)) throw new ApiError(409, "Payment transaction cannot be completed");
  await payment.update({ status: "completed", providerTransactionId: String(details.trnId || details.transactionId), providerReference: details.orderId, providerStatusCode: String(details.status || "SUCCESS"), providerStatusMessage: safeMessage(details.desc), verifiedAmount, verifiedAt: new Date(), completedAt: new Date(), verificationSource: source, lastStatusCheckedAt: source === "directpay_status_check" ? new Date() : payment.lastStatusCheckedAt }, { transaction });
  const fromStatus = order.status;
  await order.update({ status: "completed", paymentStatus: "verified", paymentMethod: "directpay", completedAt: new Date() }, { transaction });
  const entitlements = await grantOrderEntitlements(order, null, transaction);
  await db.OrderStatusHistory.create({ orderId: order.id, fromStatus, toStatus: "completed", paymentStatus: "verified", reason: source, actorUserId: null }, { transaction });
  return { payment, order, entitlements, idempotent: false };
});

export const handleDirectPayCallback = async (payload, config = getDirectPayConfig()) => {
  validateResponsePayload(payload); assertDirectPayConfig(config);
  const signatureValid = verifyPayload(responseSigningPayload(payload), payload.signature, readConfiguredKey(config.publicKeyPath));
  const payloadHash = eventHash(payload);
  const existing = await db.PaymentProviderEvent.findOne({ where: { payloadHash } }); if (existing?.processed) return { received: true, duplicate: true };
  const payment = await db.PaymentTransaction.findOne({ where: { merchantReference: payload.orderId, provider: "directpay" } });
  const event = existing || await db.PaymentProviderEvent.create({ provider: "directpay", providerEventId: String(payload.trnId), paymentTransactionId: payment?.id || null, orderId: payment?.orderId || null, eventType: String(payload.type || "ONE_TIME"), eventStatus: String(payload.status), payloadHash, signatureValid });
  if (!signatureValid || !payment) { await event.update({ processed: true, processedAt: new Date(), processingError: signatureValid ? "Unknown merchant reference" : "Invalid signature" }); throw new ApiError(400, "DirectPay callback could not be verified"); }
  const state = providerStatus(payload.status);
  try {
    if (state === "success") await payment.update({ status: "processing", providerTransactionId: String(payload.trnId), providerReference: payload.orderId, providerStatusCode: payload.status, providerStatusMessage: safeMessage(payload.desc), verificationSource: "directpay_callback" });
    else await db.sequelize.transaction((transaction) => markProviderState(payment, state, payload, "directpay_callback", transaction));
    await event.update({ processed: true, processedAt: new Date() });
    return { received: true, paymentId: payment.id, requiresStatusCheck: state === "success" };
  } catch (error) { await event.update({ processed: true, processedAt: new Date(), processingError: safeMessage(error.message) }); throw error; }
};

export const checkDirectPayStatus = async (paymentId, source = "directpay_status_check", config = getDirectPayConfig()) => {
  assertDirectPayConfig(config); const payment = await db.PaymentTransaction.findByPk(paymentId); if (!payment) throw new ApiError(404, "Payment transaction not found");
  if (payment.status === "completed") return { payment, idempotent: true };
  if (!payment.providerTransactionId) return { payment, pending: true };
  if (payment.lastStatusCheckedAt && Date.now() - new Date(payment.lastStatusCheckedAt).getTime() < config.pollIntervalMs) return { payment, pending: true, rateLimited: true };
  const body = { merchantId: config.merchantId, type: "TRANSACTION_STATUS", transactionId: payment.providerTransactionId, merchantReference: payment.merchantReference };
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  let response; try { response = await fetch(`${config.apiBaseUrl}/transaction/paymentStatus`, { method: "POST", headers: { "Content-Type": "application/json", Signature: signPayload(statusSigningPayload(body), readConfiguredKey(config.privateKeyPath)), "x-api-key": config.apiKey }, body: JSON.stringify(body), signal: controller.signal }); } catch { await payment.update({ lastStatusCheckedAt: new Date(), verificationSource: source }); return { payment, pending: true, transientError: true }; } finally { clearTimeout(timer); }
  const json = await response.json().catch(() => ({})); const data = Array.isArray(json.data) ? json.data[0] : null;
  if (!response.ok || !data) { await payment.update({ lastStatusCheckedAt: new Date(), verificationSource: source, providerStatusMessage: safeMessage(json?.data?.message) }); return { payment, pending: true }; }
  const details = { ...data, orderId: payment.merchantReference, trnId: data.transactionId, desc: data.bankerResponseDesc, status: data.status };
  if (providerStatus(data.status) === "success") return processVerifiedPayment(payment.id, details, source);
  return db.sequelize.transaction(async (transaction) => ({ payment: await markProviderState(payment, providerStatus(data.status), details, source, transaction), pending: providerStatus(data.status) === "pending" }));
};

export const studentPaymentStatus = async (userId, orderId, check = false) => {
  const payment = await db.PaymentTransaction.findOne({ include: [{ model: db.Order, where: { id: orderId, userId } }], where: { provider: "directpay" }, order: [["createdAt", "DESC"]] }); if (!payment) throw new ApiError(404, "DirectPay payment not found");
  const result = check && ["processing", "customer_action_required", "initiated"].includes(payment.status) ? await checkDirectPayStatus(payment.id) : { payment };
  const fresh = result.payment || payment; return { id: fresh.id, orderId, status: fresh.status, amount: fresh.amount, currency: fresh.currency, paymentMethod: fresh.paymentMethod, providerReference: fresh.providerReference, nextPollAfterMs: ["processing", "customer_action_required", "initiated"].includes(fresh.status) ? getDirectPayConfig().pollIntervalMs : null, entitlementActive: fresh.status === "completed" };
};
