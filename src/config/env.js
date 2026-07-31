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
});
