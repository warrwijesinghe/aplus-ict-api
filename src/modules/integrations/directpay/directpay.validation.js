import { ApiError } from "../../../core/errors.js";

// The current DirectPay JavaScript SDK posts this envelope to the Confirmation
// Endpoint configured in the merchant portal.  Do not accept browser callback
// payloads here: they have a different, untrusted role.
export const parseConfirmationPayload = (payload) => {
  const data = payload?.data;
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !data || typeof data !== "object" || Array.isArray(data))
    throw new ApiError(422, "DirectPay confirmation payload is invalid");
  const required = ["transactionId", "status", "reference", "amount", "currency"];
  const missing = required.filter((field) => !String(data[field] ?? "").trim());
  if (missing.length) throw new ApiError(422, "DirectPay confirmation payload is incomplete", { missing });
  if (payload.paymentCategory && payload.paymentCategory !== "ONE_TIME") throw new ApiError(422, "Unsupported DirectPay payment category");
  return {
    transactionId: String(data.transactionId), status: String(data.status).toUpperCase(), reference: String(data.reference),
    amount: String(data.amount), currency: String(data.currency).toUpperCase(), description: String(data.description || ""),
  };
};
