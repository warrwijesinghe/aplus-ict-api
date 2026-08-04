import { ApiError } from "../../../core/errors.js";

const requiredStrings = ["orderId", "transactionId", "reference", "amount", "currency", "status", "signature"];

export const validateResponsePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError(422, "DirectPay response payload must be an object");
  const missing = requiredStrings.filter((name) => !String(payload[name] ?? "").trim());
  if (missing.length) throw new ApiError(422, "DirectPay response payload is incomplete", { missing });
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) < 0)
    throw new ApiError(422, "DirectPay response amount is invalid");
  return payload;
};
