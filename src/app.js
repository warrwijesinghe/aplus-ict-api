import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import routes from "./modules/routes.js";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./core/middleware.js";
import { sequelize } from "./config/database.js";
import { db } from "./models/index.js";
import { streamResource } from "./modules/resources/resource.service.js";
import crypto from "crypto";
export const app = express();
// Keep local and development diagnostics useful without logging credentials,
// tokens, request bodies, or query values.
app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  const origin = req.get("origin");
  let originHost = "direct";
  try {
    originHost = origin ? new URL(origin).host : "direct";
  } catch {
    originHost = "invalid";
  }
  res.set("X-Request-Id", requestId);
  res.on("finish", () => {
    if (req.path.startsWith("/api/") || req.path === "/health" || req.path === "/ready")
      console.info(
        `[api] time=${new Date().toISOString()} id=${requestId} method=${req.method} path=${req.path} status=${res.statusCode} durationMs=${Date.now() - startedAt} user=${req.user?.sub || "anonymous"} origin=${originHost}`,
      );
  });
  next();
});
// Nginx is the TLS reverse proxy in deployment, so Express must trust proxy headers.
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.origins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
// Only public content is ever exposed as static files. Private uploads are streamed
// by authenticated resource/payment endpoints instead.
// Public files are still checked against their Resource record. This prevents a
// formerly public file from remaining reachable after archive/delete.
if (env.servePublicUploads)
  app.use(env.publicUploadUrl, async (req, res, next) => {
    try {
      const storageKey = decodeURIComponent(req.path).replace(/^\/+/, "");
      if (!storageKey || storageKey.includes("..") || storageKey.includes("\\")) return res.sendStatus(404);
      const resource = await db.Resource.findOne({ attributes: ["id", "storageKey", "visibility", "accessPolicy", "status", "mimeType", "sizeBytes", "displayName", "originalFilename", "extension"], where: { storageKey, visibility: "public", accessPolicy: "public", status: ["active", "ready"] } });
      if (!resource) return res.sendStatus(404);
      return streamResource(req, res, resource);
    } catch (error) {
      // A deployment must run the Resource migration before public uploads are
      // enabled; fail closed during that transition rather than serving files.
      if (error?.original?.code === "ER_BAD_FIELD_ERROR") return res.sendStatus(404);
      return next(error);
    }
  });
app.use(rateLimit({ windowMs: 15 * 60e3, limit: 500, standardHeaders: true }));
app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "aplus-ict-api" }),
);
app.get("/ready", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});
// Keep a stable, versioned boundary for both frontend applications.
app.use("/api/v1", routes);
app.use(notFound);
app.use(errorHandler);
