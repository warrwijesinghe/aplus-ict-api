import crypto from "node:crypto";
import { ApiError } from "../../../core/errors.js";

// Keep the signed fields explicit and deterministic; never sign arbitrary client input.
export const responseSigningPayload = ({ orderId, transactionId, reference, amount, currency, status }) =>
  [orderId, transactionId, reference, amount, currency, status].map((value) => String(value ?? "")).join("|");

export const signPayload = (payload, privateKey) => {
  if (!privateKey) throw new ApiError(503, "DirectPay signing key is not configured");
  return crypto.sign("sha256", Buffer.from(payload), privateKey).toString("base64");
};

export const verifyPayload = (payload, signature, publicKey) => {
  if (!publicKey) throw new ApiError(503, "DirectPay verification key is not configured");
  if (!signature || typeof signature !== "string") return false;
  try {
    return crypto.verify("sha256", Buffer.from(payload), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
};
