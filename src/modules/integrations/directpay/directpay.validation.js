import { ApiError } from "../../../core/errors.js";
const required = ["orderId", "trnId", "status", "desc", "signature"];
export const validateResponsePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ApiError(422, "DirectPay callback payload must be an object");
  const missing = required.filter((name) => !String(payload[name] ?? "").trim());
  if (missing.length) throw new ApiError(422, "DirectPay callback payload is incomplete", { missing });
  if (String(payload.type || "ONE_TIME") !== "ONE_TIME") throw new ApiError(422, "Unsupported DirectPay payment type");
  return payload;
};
