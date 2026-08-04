import { getDirectPayConfig, readConfiguredKey } from "./directpay.config.js";
import { responseSigningPayload, signPayload, verifyPayload } from "./directpay.signature.js";
import { validateResponsePayload } from "./directpay.validation.js";
import { ApiError } from "../../../core/errors.js";

const requiredConfiguration = ["merchantId", "apiKey", "privateKeyPath", "publicKeyPath", "returnUrl", "cancelUrl", "responseUrl"];

export const directPayHealth = (config = getDirectPayConfig()) => {
  if (!config.enabled) return { status: "disabled", environment: config.environment, enabled: false };
  const missing = requiredConfiguration.filter((name) => !config[name]);
  if (config.environment !== "sandbox") missing.push("sandbox environment");
  if (config.privateKeyPath && !readConfiguredKey(config.privateKeyPath)) missing.push("private signing key");
  if (config.publicKeyPath && !readConfiguredKey(config.publicKeyPath)) missing.push("public verification key");
  return missing.length
    ? { status: "incomplete", environment: config.environment, enabled: true, missing }
    : { status: "ready", environment: "sandbox", enabled: true };
};

export const createSignedPaymentRequest = ({ order, product, student }, config = getDirectPayConfig()) => {
  const health = directPayHealth(config);
  if (health.status !== "ready") throw new ApiError(503, "DirectPay sandbox is not ready", health);
  // Callers must load these records from the database; this service never trusts browser prices.
  if (!order?.id || !product?.price || !student?.id) throw new ApiError(422, "A verified order, product and student are required");
  const request = {
    merchantId: config.merchantId,
    amount: String(product.price),
    currency: product.currency || "LKR",
    reference: order.orderNumber || order.id,
    description: product.name,
    returnUrl: config.returnUrl,
    cancelUrl: config.cancelUrl,
    responseUrl: config.responseUrl,
    orderId: order.id,
    apiKey: config.apiKey,
  };
  return { ...request, signature: signPayload(JSON.stringify(request), readConfiguredKey(config.privateKeyPath)) };
};

export const verifyDirectPayResponse = (payload, config = getDirectPayConfig()) => {
  validateResponsePayload(payload);
  const health = directPayHealth(config);
  if (health.status !== "ready") throw new ApiError(503, "DirectPay sandbox is not ready", health);
  const valid = verifyPayload(responseSigningPayload(payload), payload.signature, readConfiguredKey(config.publicKeyPath));
  if (!valid) throw new ApiError(400, "DirectPay response signature is invalid");
  return { orderId: payload.orderId, transactionId: payload.transactionId, reference: payload.reference, status: payload.status };
};
