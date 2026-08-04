import { existsSync, readFileSync } from "node:fs";

export const getDirectPayConfig = (source = process.env) => ({
  enabled: String(source.DIRECTPAY_ENABLED || "false").toLowerCase() === "true",
  environment: source.DIRECTPAY_ENVIRONMENT || "sandbox",
  merchantId: source.DIRECTPAY_MERCHANT_ID || "",
  apiKey: source.DIRECTPAY_API_KEY || "",
  privateKeyPath: source.DIRECTPAY_PRIVATE_KEY_PATH || "",
  publicKeyPath: source.DIRECTPAY_PUBLIC_KEY_PATH || "",
  returnUrl: source.DIRECTPAY_RETURN_URL || "",
  cancelUrl: source.DIRECTPAY_CANCEL_URL || "",
  responseUrl: source.DIRECTPAY_RESPONSE_URL || "",
});

export const readConfiguredKey = (keyPath) => {
  if (!keyPath || !existsSync(keyPath)) return null;
  return readFileSync(keyPath, "utf8");
};
