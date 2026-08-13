import { ApiError } from "../../core/errors.js";

export const MOBITEL_GATEWAYS = Object.freeze({
  standard: "https://msmsenterpriseapi.mobitel.lk/EnterpriseSMSV3/esmsproxyURL.php",
  multilingual: "https://msmsenterpriseapi.mobitel.lk/EnterpriseSMSV3/esmsproxy_multilang.php",
});

export const getSmsConfig = (source = process.env) => ({
  enabled: String(source.SMS_ENABLED || "false").toLowerCase() === "true",
  username: source.SMS_USERNAME || "",
  password: source.SMS_PASSWORD || "",
  sender: source.SMS_SENDER || "",
  workerIntervalMs: Math.max(1000, Number(source.SMS_WORKER_INTERVAL_MS || 5000)),
  requestTimeoutMs: Math.max(1000, Number(source.SMS_REQUEST_TIMEOUT_MS || 15000)),
  sendingTimeoutMs: Math.max(60_000, Number(source.SMS_SENDING_TIMEOUT_MS || 300_000)),
  inboundToken: source.SMS_INBOUND_TOKEN || "",
});

export const assertSmsConfig = (config = getSmsConfig()) => {
  if (!config.enabled) throw new ApiError(503, "SMS service is disabled");
  const missing = ["username", "password", "sender"].filter((key) => !config[key]);
  if (missing.length) throw new ApiError(503, "SMS service configuration is incomplete", { missing });
  if (!/^[A-Za-z0-9]{1,11}$/.test(config.sender))
    throw new ApiError(503, "SMS sender configuration is invalid");
  return config;
};
