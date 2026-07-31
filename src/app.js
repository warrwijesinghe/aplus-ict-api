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
import path from "path";
export const app = express();
// Nginx is the TLS reverse proxy in deployment, so Express must trust proxy headers.
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.origins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
// Only public content is ever exposed as static files. Private uploads are streamed
// by authenticated resource/payment endpoints instead.
if (env.servePublicUploads)
  app.use(env.publicUploadUrl, express.static(path.resolve(env.publicUploadDir)));
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
