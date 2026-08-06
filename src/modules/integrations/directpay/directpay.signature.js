import crypto from "node:crypto";
import { ApiError } from "../../../core/errors.js";

// DirectPay browser-payment docs prescribe this field order and concatenate
// values without delimiters before RSA/SHA-256 + Base64 signing.
export const browserSigningPayload = (request) => [
  request.merchantId, request.amount, request.currency, request.pluginName,
  request.pluginVersion, request.returnUrl, request.cancelUrl, request.orderId,
  request.reference, request.firstName, request.lastName, request.email,
  request.description, request.apiKey, request.responseUrl,
].map((value) => String(value ?? "")).join("");

export const statusSigningPayload = (request) => [request.merchantId, request.type, request.transactionId, request.merchantReference].map((value) => String(value ?? "")).join("");
export const responseSigningPayload = ({ orderId, trnId, status, desc }) => [orderId, trnId, status, desc].map((value) => String(value ?? "")).join("");

export const signPayload = (payload, privateKey) => {
  if (!privateKey) throw new ApiError(503, "DirectPay signing key is not configured");
  try { return crypto.sign("RSA-SHA256", Buffer.from(payload, "utf8"), privateKey).toString("base64"); }
  catch { throw new ApiError(503, "DirectPay signing key could not be used"); }
};
export const verifyPayload = (payload, signature, publicKey) => {
  if (!publicKey) throw new ApiError(503, "DirectPay verification key is not configured");
  if (!signature || typeof signature !== "string") return false;
  try { return crypto.verify("RSA-SHA256", Buffer.from(payload, "utf8"), publicKey, Buffer.from(signature, "base64")); } catch { return false; }
};
