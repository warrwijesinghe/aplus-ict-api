import { ApiError } from "../../../core/errors.js";

export const getPayHereConfig = (source = process.env) => ({
  sandbox: String(source.PAYHERE_SANDBOX || "true").toLowerCase() === "true",
  merchantId: source.PAYHERE_MERCHANT_ID || "",
  merchantSecret: source.PAYHERE_MERCHANT_SECRET || "",
  notifyUrl: source.PAYHERE_NOTIFY_URL || "",
});

export const assertPayHereConfig = (config = getPayHereConfig()) => {
  if (!config.merchantId || !config.merchantSecret || !config.notifyUrl)
    throw new ApiError(503, "PayHere merchant configuration is incomplete");
  return config;
};
