import "dotenv/config";
const required = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"];
for (const name of required)
  if (!process.env[name] && process.env.NODE_ENV === "production")
    throw new Error(`${name} is required`);
export const env = Object.freeze({
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    name: process.env.DB_NAME || "aplus_ict",
    user: process.env.DB_USER || "aplus_ict",
    password: process.env.DB_PASSWORD || "",
  },
  accessSecret:
    process.env.JWT_ACCESS_SECRET || "development-access-secret-change-me",
  refreshSecret:
    process.env.JWT_REFRESH_SECRET || "development-refresh-secret-change-me",
  origins: (
    process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:5174"
  ).split(","),
  publicWebUrl: (process.env.WEB_PUBLIC_URL || "http://localhost:5173").replace(/\/+$/, ""),
  uploadRoot: process.env.UPLOAD_ROOT || "storage/uploads",
  publicUploadDir:
    process.env.PUBLIC_UPLOAD_DIR || "storage/uploads/public",
  privateUploadDir:
    process.env.PRIVATE_UPLOAD_DIR || "storage/uploads/private",
  publicUploadUrl: process.env.PUBLIC_UPLOAD_URL || "/uploads",
  servePublicUploads:
    (process.env.SERVE_PUBLIC_UPLOADS || "true").toLowerCase() === "true",
  maxImageUploadBytes: Number(process.env.MAX_IMAGE_UPLOAD_MB || 10) * 1024 * 1024,
  maxDocumentUploadBytes:
    Number(process.env.MAX_DOCUMENT_UPLOAD_MB || 25) * 1024 * 1024,
  maxPaymentSlipUploadBytes:
    Number(process.env.MAX_PAYMENT_SLIP_UPLOAD_MB || 10) * 1024 * 1024,
  resourceMaxUploadBytes: Number(process.env.RESOURCE_MAX_UPLOAD_MB || 25) * 1024 * 1024,
  resourceTempDir: process.env.RESOURCE_TEMP_DIR || "storage/tmp",
  resourceArchiveRetentionDays: Number(process.env.RESOURCE_ARCHIVE_RETENTION_DAYS || 90),
  paymentSlipRetentionDays: Number(process.env.PAYMENT_SLIP_RETENTION_DAYS || 2555),
  assignmentSubmissionRetentionDays: Number(process.env.ASSIGNMENT_SUBMISSION_RETENTION_DAYS || 730),
  sms: {
    enabled: (process.env.SMS_ENABLED || "false").toLowerCase() === "true",
    username: process.env.SMS_USERNAME || "",
    password: process.env.SMS_PASSWORD || "",
    sender: process.env.SMS_SENDER || "",
    workerIntervalMs: Math.max(1000, Number(process.env.SMS_WORKER_INTERVAL_MS || 5000)),
    requestTimeoutMs: Math.max(1000, Number(process.env.SMS_REQUEST_TIMEOUT_MS || 15000)),
    sendingTimeoutMs: Math.max(60_000, Number(process.env.SMS_SENDING_TIMEOUT_MS || 300_000)),
    inboundToken: process.env.SMS_INBOUND_TOKEN || "",
  },
});
