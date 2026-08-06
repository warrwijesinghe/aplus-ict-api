import { existsSync, readFileSync } from "node:fs";
import { ApiError } from "../../../core/errors.js";

const environments = {
  sandbox: { checkoutUrl: "https://testpay.directpay.lk/", apiBaseUrl: "https://dev.directpay.lk/v1/mpg/api/external" },
  production: { checkoutUrl: "https://pay.directpay.lk/", apiBaseUrl: "https://prod.directpay.lk/v1/mpg/api/external" },
};
export const LEGAL_MERCHANT_NAME = "Miracle Network and Solutions (Pvt) Ltd";
export const getDirectPayConfig = (source = process.env) => {
  const environment = source.DIRECTPAY_ENVIRONMENT || "sandbox";
  const documented = environments[environment];
  return { enabled: String(source.DIRECTPAY_ENABLED || "false").toLowerCase() === "true", environment, merchantId: source.DIRECTPAY_MERCHANT_ID || "", apiKey: source.DIRECTPAY_API_KEY || "", privateKeyPath: source.DIRECTPAY_PRIVATE_KEY_PATH || "", publicKeyPath: source.DIRECTPAY_PUBLIC_KEY_PATH || "", returnUrl: source.DIRECTPAY_RETURN_URL || "", cancelUrl: source.DIRECTPAY_CANCEL_URL || "", responseUrl: source.DIRECTPAY_RESPONSE_URL || source.DIRECTPAY_CALLBACK_URL || "", checkoutUrl: source.DIRECTPAY_CHECKOUT_URL || documented?.checkoutUrl || "", apiBaseUrl: source.DIRECTPAY_API_BASE_URL || documented?.apiBaseUrl || "", timeoutMs: Math.max(1000, Number(source.DIRECTPAY_REQUEST_TIMEOUT_MS || 10000)), pollIntervalMs: Math.max(1000, Number(source.DIRECTPAY_STATUS_POLL_INTERVAL_MS || 3000)), merchantLegalName: source.DIRECTPAY_MERCHANT_LEGAL_NAME || LEGAL_MERCHANT_NAME };
};
export const readConfiguredKey = (keyPath) => { if (!keyPath || !existsSync(keyPath)) return null; return readFileSync(keyPath, "utf8"); };
export const assertDirectPayConfig = (config = getDirectPayConfig()) => {
  const missing = ["merchantId", "apiKey", "privateKeyPath", "publicKeyPath", "returnUrl", "cancelUrl", "responseUrl", "checkoutUrl", "apiBaseUrl"].filter((key) => !config[key]);
  if (!environments[config.environment]) missing.push("valid environment");
  if (config.merchantLegalName !== LEGAL_MERCHANT_NAME) missing.push("expected merchant legal name");
  if (config.privateKeyPath && !readConfiguredKey(config.privateKeyPath)) missing.push("private signing key");
  if (config.publicKeyPath && !readConfiguredKey(config.publicKeyPath)) missing.push("public verification key");
  if (!config.enabled) throw new ApiError(503, "DirectPay is unavailable");
  if (missing.length) throw new ApiError(503, "DirectPay configuration is incomplete", { missing });
  return config;
};
