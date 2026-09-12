import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.js";
import { db } from "../../models/index.js";
import { ApiError, asyncHandler } from "../../core/errors.js";
import { attachAuthorization, getAuthorization } from "../../security/authorization.js";
import { hasValidReviewerCredentials } from "./reviewer-credentials.js";
import { phoneAuth } from "./phone-auth.service.js";
// Persist only a refresh-token hash; the original token cannot be recovered from the database.
const hash = (x) => crypto.createHash("sha256").update(x).digest("hex");
const publicUser = (user, authorization = {}) => ({
  id: user.id,
  email: user.email,
  phoneNumber: user.phoneNumber || null,
  name: user.name,
  role: authorization.role || user.role,
  roles: authorization.roles || [user.role],
  permissions: authorization.permissions || [],
});
// Access tokens are short lived. The longer-lived refresh token stays in an HTTP-only cookie.
const issue = async (user, res) => {
  const authorization = await getAuthorization(user.id);
  const accessToken = jwt.sign(
    { sub: user.id, role: authorization.role, ver: user.authVersion || 0 },
    env.accessSecret,
    { expiresIn: "15m" },
  );
  const refresh = jwt.sign(
    { sub: user.id, type: "refresh", ver: user.authVersion || 0 },
    env.refreshSecret,
    { expiresIn: "30d", jwtid: crypto.randomUUID() },
  );
  await db.RefreshToken.create({
    userId: user.id,
    tokenHash: hash(refresh),
    expiresAt: new Date(Date.now() + 30 * 864e5),
  });
  res.cookie("aplus_refresh", refresh, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: "/api/v1/auth",
  });
  return { accessToken, user: publicUser(user, authorization) };
};
export const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) throw new ApiError(401, "Authentication required");
  try {
    req.user = jwt.verify(token, env.accessSecret);
    attachAuthorization(req, res, next);
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }
});

// Public pages may have a mix of free and paid entries. This middleware accepts
// anonymous visitors but records the current user when a valid token is supplied.
export const optionallyAuthenticate = asyncHandler(async (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
});
export const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, "Insufficient permission"));
export const authRoutes = (router) => {
  const limit = (count, minutes = 15) => rateLimit({
    windowMs: minutes * 60_000, limit: count, standardHeaders: true, legacyHeaders: false,
    message: { error: { message: "Too many authentication attempts. Please try again later." } },
  });
  router.post("/auth/phone/otp", limit(20, 60), asyncHandler(async (req, res) =>
    res.json({ data: await phoneAuth.requestOtp(req.body) })));
  router.post("/auth/phone/verify", limit(30), asyncHandler(async (req, res) =>
    res.json({ data: await phoneAuth.verifyOtp(req.body) })));
  router.post("/auth/phone/register", limit(10), asyncHandler(async (req, res) =>
    res.status(201).json({ data: await issue(await phoneAuth.register(req.body), res) })));
  router.post("/auth/phone/login", limit(15), asyncHandler(async (req, res) =>
    res.json({ data: await issue(await phoneAuth.login(req.body), res) })));
  router.post("/auth/phone/reset-password", limit(10), asyncHandler(async (req, res) => {
    await phoneAuth.resetPassword(req.body);
    res.clearCookie("aplus_refresh", { path: "/api/v1/auth" });
    res.json({ data: { ok: true } });
  }));
  // Admin credentials remain platform-managed.
  router.post(
    "/auth/admin/login",
    asyncHandler(async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password)
        throw new ApiError(422, "Email and password are required");
      const user = await db.User.findOne({ where: { email, role: ["admin", "super_admin", "teacher", "content_editor"] } });
      if (
        !user ||
        !user.passwordHash ||
        !(await bcrypt.compare(password, user.passwordHash))
      )
        throw new ApiError(401, "Invalid credentials");
      res.json({ data: await issue(user, res) });
    }),
  );
  // This endpoint is deliberately separate from student phone sign-in. It is
  // available only to the single, server-configured review account and shares
  // the ordinary JWT and refresh-cookie session implementation.
  router.post(
    "/auth/reviewer-login",
    rateLimit({
      windowMs: 15 * 60e3,
      limit: 10,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { message: "Too many review sign-in attempts. Please try again later." } },
    }),
    asyncHandler(async (req, res) => {
      if (!env.reviewLogin.enabled)
        throw new ApiError(503, "Review access is currently unavailable.");

      if (!(await hasValidReviewerCredentials({ ...req.body, config: env.reviewLogin }))) {
        throw new ApiError(401, "Invalid review credentials.");
      }

      const user = await db.User.findOne({ where: { email: env.reviewLogin.email, role: "student" } });
      if (!user || user.status !== "active")
        throw new ApiError(401, "Invalid review credentials.");
      res.json({ data: await issue(user, res) });
    }),
  );
  router.post(
    "/auth/refresh",
    asyncHandler(async (req, res) => {
      const token = req.cookies.aplus_refresh;
      if (!token) throw new ApiError(401, "Refresh token required");
      try {
        const decoded = jwt.verify(token, env.refreshSecret);
        const record = await db.RefreshToken.findOne({
          where: {
            userId: decoded.sub,
            tokenHash: hash(token),
            revokedAt: null,
          },
        });
        if (!record || record.expiresAt < new Date()) throw new Error();
        // Rotate refresh tokens to make the previous token single-use.
        await record.update({ revokedAt: new Date() });
        const user = await db.User.findByPk(decoded.sub);
        if (!user || user.status !== "active" || (decoded.ver || 0) !== (user.authVersion || 0)) throw new Error();
        res.json({ data: await issue(user, res) });
      } catch {
        throw new ApiError(401, "Invalid refresh token");
      }
    }),
  );
  router.post(
    "/auth/logout",
    asyncHandler(async (req, res) => {
      if (req.cookies.aplus_refresh)
        await db.RefreshToken.update(
          { revokedAt: new Date() },
          { where: { tokenHash: hash(req.cookies.aplus_refresh) } },
        );
      res.clearCookie("aplus_refresh", { path: "/api/v1/auth" });
      res.json({ data: { ok: true } });
    }),
  );
  router.post(
    "/auth/logout-all",
    authenticate,
    asyncHandler(async (req, res) => {
      // Revoke every persisted session for this user, including the current browser.
      await db.RefreshToken.update(
        { revokedAt: new Date() },
        { where: { userId: req.user.sub, revokedAt: null } },
      );
      res.clearCookie("aplus_refresh", { path: "/api/v1/auth" });
      res.json({ data: { ok: true } });
    }),
  );
  router.get(
    "/auth/me",
    authenticate,
    asyncHandler(async (req, res) => {
      const authorization = await getAuthorization(req.user.sub);
      res.json({ data: publicUser(authorization.user, authorization) });
    }),
  );
};
export const bootstrapAdmin = async ({
  email,
  password,
  name = "Administrator",
}) => {
  return db.sequelize.transaction(async (transaction) => {
    if (await db.User.findOne({ where: { email }, transaction }))
      throw new Error("Admin already exists");
    const user = await db.User.create({
      email, name, role: "super_admin", passwordHash: await bcrypt.hash(password, 12),
    }, { transaction });
    const role = await db.Role.findOne({ where: { code: "super_admin", isActive: true }, transaction });
    if (!role) throw new Error("The super administrator role has not been seeded");
    await db.UserRole.create({ userId: user.id, roleId: role.id }, { transaction });
    return user;
  });
};
