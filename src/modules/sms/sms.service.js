import { Op } from "sequelize";
import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";
import { assertSmsConfig, MOBITEL_GATEWAYS } from "./sms.config.js";

const GATEWAY_MESSAGES = Object.freeze({
  151: "Invalid gateway session",
  152: "Gateway session is busy",
  155: "SMS gateway service is halted",
  156: "Other-network messaging is disabled",
  157: "International messaging is disabled",
  159: "Insufficient SMS credit",
  160: "Message text is missing",
  161: "Message exceeds the gateway length limit",
  162: "Invalid message type",
  164: "Invalid group",
  165: "No recipients were supplied",
  166: "Recipient list exceeds the gateway limit",
  167: "Invalid recipient number",
  168: "Invalid short code",
  169: "Invalid sender alias",
  170: "A recipient is blacklisted",
  171: "A recipient is not whitelisted",
});
export const SMS_CATEGORIES = Object.freeze({
  general: "GENERAL",
  registration: "REG",
  payment: "PAYMENT",
  notification: "NOTIFICATION",
  reminder: "REMINDER",
});

const clean = (value) => String(value || "").trim();
const compact = (value) => clean(value).replace(/[\s()\-]/g, "");
const clip = (value, length = 500) => clean(value).slice(0, length) || null;

export const normalizeSriLankanMobile = (value) => {
  let number = compact(value).replace(/^\+/, "");
  if (/^0\d{9}$/.test(number)) number = `94${number.slice(1)}`;
  if (!/^94\d{9}$/.test(number))
    throw new ApiError(422, "Recipient must be a Sri Lankan mobile number, for example 94771234567");
  return number;
};

const validateSmsInput = (input) => {
  const text = clean(input.text);
  const contentType = input.contentType === "multilingual" ? "multilingual" : "standard";
  const messageType = Number(input.messageType);
  const category = Object.hasOwn(SMS_CATEGORIES, input.category) ? input.category : "general";
  if (!text) throw new ApiError(422, "SMS text is required");
  if ([...text].length > 160) throw new ApiError(422, "SMS text may not exceed 160 characters");
  if (![0, 1].includes(messageType)) throw new ApiError(422, "Message type must be 0 (non-promotional) or 1 (promotional)");
  return { recipient: normalizeSriLankanMobile(input.recipient || input.to), text, category, contentType, messageType };
};

const toResponse = (message) => ({
  id: message.id,
  recipient: message.recipient,
  sender: message.sender,
  text: message.text,
  category: message.category || "general",
  messageType: message.messageType,
  contentType: message.contentType,
  status: message.status,
  attemptCount: message.attemptCount,
  maxAttempts: message.maxAttempts,
  nextAttemptAt: message.nextAttemptAt,
  lastAttemptAt: message.lastAttemptAt,
  acceptedAt: message.acceptedAt,
  failedAt: message.failedAt,
  gatewayCode: message.gatewayCode,
  failureReason: message.failureReason,
  eventKey: message.eventKey || null,
  createdAt: message.createdAt,
  resentFromMessageId: message.resentFromMessageId,
  createdBy: message.CreatedBy ? { id: message.CreatedBy.id, name: message.CreatedBy.name, email: message.CreatedBy.email } : undefined,
  attempts: message.Attempts?.map((attempt) => ({ id: attempt.id, attemptNumber: attempt.attemptNumber, status: attempt.status, gatewayCode: attempt.gatewayCode, failureReason: attempt.failureReason, startedAt: attempt.startedAt, completedAt: attempt.completedAt })),
});

export const listSmsMessages = async (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const where = {};
  if (["queued", "sending", "sent", "failed"].includes(query.status)) where.status = query.status;
  if (query.recipient) where.recipient = { [Op.like]: `%${compact(query.recipient)}%` };
  const { count, rows } = await db.SmsMessage.findAndCountAll({
    where,
    include: [
      { model: db.User, as: "CreatedBy", attributes: ["id", "name", "email"] },
      { model: db.SmsMessageAttempt, as: "Attempts", attributes: ["id", "attemptNumber", "status", "gatewayCode", "failureReason", "startedAt", "completedAt"], separate: true, order: [["attemptNumber", "DESC"]] },
    ],
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: rows.map(toResponse), pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};

export const queueSms = async (input, userId, { resentFromMessageId = null, transaction } = {}) => {
  const config = assertSmsConfig();
  const values = validateSmsInput(input);
  const message = await db.SmsMessage.create({ ...values, sender: config.sender, createdByUserId: userId, resentFromMessageId, nextAttemptAt: new Date() }, { transaction });
  return toResponse(message);
};

// Automated business notifications are deduplicated by a database-enforced
// event key.  Manual Admin messages and resend requests deliberately use
// queueSms instead, so an operator can always send an intentional resend.
export const queueAutomatedSms = async (input, userId, eventKey, { transaction } = {}) => {
  if (!eventKey || typeof eventKey !== "string") throw new ApiError(422, "SMS event key is required");
  const config = assertSmsConfig();
  const values = validateSmsInput(input);
  const [message, created] = await db.SmsMessage.findOrCreate({
    where: { eventKey },
    defaults: { ...values, sender: config.sender, eventKey, createdByUserId: userId, nextAttemptAt: new Date() },
    transaction,
  });
  return { ...toResponse(message), created };
};

export const resendSms = async (messageId, userId) => {
  const original = await db.SmsMessage.findByPk(messageId);
  if (!original) throw new ApiError(404, "SMS message not found");
  if (original.status === "sending") throw new ApiError(409, "This SMS is currently being sent; wait for its result before resending");
  return queueSms(original, userId, { resentFromMessageId: original.id });
};

export const receiveSms = async (input) => {
  const sender = clean(input.from);
  const recipient = clean(input.to);
  const message = clean(input.message);
  if (!sender || !recipient || !message) throw new ApiError(422, "Inbound SMS requires from, to, and message fields");
  return db.SmsInboundMessage.create({ sender, recipient, message, receivedAt: new Date() });
};

const parseGatewayResponse = (response, body) => {
  const code = body.match(/\b(?:200|1[5-7]\d)\b/)?.[0] || (response.ok ? "200" : String(response.status));
  return { code, response: clip(body, 2000), accepted: code === "200" };
};

export const sendToMobitel = async (message, config, fetchImpl = fetch) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    let response;
    if (message.contentType === "multilingual") {
      const params = new URLSearchParams({ m: message.text, r: message.recipient, a: message.sender, u: config.username, p: config.password, t: String(message.messageType) });
      response = await fetchImpl(`${MOBITEL_GATEWAYS.multilingual}?${params.toString()}`, { method: "POST", signal: controller.signal });
    } else {
      response = await fetchImpl(MOBITEL_GATEWAYS.standard, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: config.username, password: config.password, from: message.sender, to: message.recipient, text: message.text, mesageType: message.messageType }), signal: controller.signal });
    }
    return parseGatewayResponse(response, await response.text());
  } finally {
    clearTimeout(timeout);
  }
};

const markAttempt = async (messageId, attemptNumber, values) => {
  await db.SmsMessageAttempt.update(values, { where: { smsMessageId: messageId, attemptNumber } });
};

export const claimNextSms = async () => db.sequelize.transaction(async (transaction) => {
  const message = await db.SmsMessage.findOne({ where: { status: "queued", nextAttemptAt: { [Op.lte]: new Date() } }, order: [["createdAt", "ASC"]], lock: transaction.LOCK.UPDATE, skipLocked: true, transaction });
  if (!message) return null;
  const startedAt = new Date();
  const attemptNumber = message.attemptCount + 1;
  await message.update({ status: "sending", attemptCount: attemptNumber, lastAttemptAt: startedAt, failureReason: null }, { transaction });
  await db.SmsMessageAttempt.create({ smsMessageId: message.id, attemptNumber, status: "sending", startedAt }, { transaction });
  return message;
});

export const processNextSms = async (config = assertSmsConfig(), fetchImpl = fetch) => {
  const message = await claimNextSms();
  if (!message) return null;
  const completedAt = new Date();
  try {
    const result = await sendToMobitel(message, config, fetchImpl);
    if (result.accepted) {
      await db.SmsMessage.update({ status: "sent", acceptedAt: completedAt, gatewayCode: result.code, gatewayResponse: result.response, failureReason: null }, { where: { id: message.id } });
      await markAttempt(message.id, message.attemptCount, { status: "accepted", gatewayCode: result.code, gatewayResponse: result.response, completedAt });
      return { id: message.id, status: "sent" };
    }
    const failureReason = GATEWAY_MESSAGES[result.code] || "SMS gateway rejected the message";
    const retryable = result.code === "152" && message.attemptCount < message.maxAttempts;
    await db.SmsMessage.update({ status: retryable ? "queued" : "failed", nextAttemptAt: retryable ? new Date(Date.now() + message.attemptCount * 5000) : message.nextAttemptAt, gatewayCode: result.code, gatewayResponse: result.response, failureReason, failedAt: retryable ? null : completedAt }, { where: { id: message.id } });
    await markAttempt(message.id, message.attemptCount, { status: "failed", gatewayCode: result.code, gatewayResponse: result.response, failureReason, completedAt });
    return { id: message.id, status: retryable ? "queued" : "failed" };
  } catch (error) {
    const failureReason = error?.name === "AbortError" ? "SMS gateway request timed out; manual resend is required" : "SMS gateway request failed; manual resend is required";
    await db.SmsMessage.update({ status: "failed", failureReason, failedAt: completedAt }, { where: { id: message.id } });
    await markAttempt(message.id, message.attemptCount, { status: "failed", failureReason: clip(error?.message), completedAt });
    return { id: message.id, status: "failed" };
  }
};

export const recoverStalledSms = async (sendingTimeoutMs) => {
  const staleAt = new Date(Date.now() - sendingTimeoutMs);
  const [count] = await db.SmsMessage.update({ status: "failed", failedAt: new Date(), failureReason: "Sending worker stopped before a gateway result was recorded; manual resend is required" }, { where: { status: "sending", lastAttemptAt: { [Op.lt]: staleAt } } });
  return count;
};

export const serializeSmsMessage = toResponse;
