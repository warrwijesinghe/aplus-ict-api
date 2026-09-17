import { ApiError } from "../../core/errors.js";

export const getSmsConfig = (source = process.env) => ({
  enabled: String(source.SMS_ENABLED || "false").toLowerCase() === "true",
  url: source.TEXTLK_SMS_URL || "",
  apiToken: source.TEXTLK_API_TOKEN || "",
  sender: source.TEXTLK_SENDER_ID || "",
  workerIntervalMs: Math.max(1000, Number(source.SMS_WORKER_INTERVAL_MS || 5000)),
  requestTimeoutMs: Math.max(1000, Number(source.SMS_REQUEST_TIMEOUT_MS || 15000)),
  sendingTimeoutMs: Math.max(60_000, Number(source.SMS_SENDING_TIMEOUT_MS || 300_000)),
});

export const assertSmsConfig = (config = getSmsConfig()) => {
  if (!config.enabled) throw new ApiError(503, "SMS service is disabled");
  const missing = ["url", "apiToken", "sender"].filter((key) => !config[key]);
  if (missing.length) throw new ApiError(503, "SMS service configuration is incomplete", { missing });
  return config;
};
