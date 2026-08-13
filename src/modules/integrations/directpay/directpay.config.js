import { ApiError } from "../../../core/errors.js";

export const getDirectPayConfig = (source = process.env) => ({
  enabled: String(source.DIRECTPAY_ENABLED || "false").toLowerCase() === "true",
  environment: source.DIRECTPAY_ENVIRONMENT || "development",
  merchantId: source.DIRECTPAY_MERCHANT_ID || "",
});

export const assertDirectPayConfig = (config = getDirectPayConfig()) => {
  if (!config.enabled) throw new ApiError(503, "DirectPay card payments are not enabled");
  if (!config.merchantId) throw new ApiError(503, "DirectPay merchant configuration is incomplete");
  return config;
};
