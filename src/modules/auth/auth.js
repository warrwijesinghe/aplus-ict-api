import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { env } from "../../config/env.js";
import { db } from "../../models/index.js";
import { ApiError, asyncHandler } from "../../core/errors.js";
import { attachAuthorization, getAuthorization } from "../../security/authorization.js";
import { assertSmsConfig } from "../sms/sms.config.js";
import { normalizeSriLankanMobile, sendToMobitel } from "../sms/sms.service.js";
// Persist only a refresh-token hash; the original token cannot be recovered from the database.
const hash = (x) => crypto.createHash("sha256").update(x).digest("hex");
const OTP_TTL_MS = 5 * 60e3;
const OTP_RESEND_MS = 60e3;
const OTP_MAX_ATTEMPTS = 5;
const passwordIsValid = (value) =>
  typeof value === "string" &&
  Buffer.byteLength(value, "utf8") <= 72 &&
  value.length >= 8 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value);
const otpCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
const otpProof = (challenge) => jwt.sign(
  { type: "phone-otp", challengeId: challenge.id, phoneNumber: challenge.phoneNumber, purpose: challenge.purpose },
  env.accessSecret,
  { expiresIn: "10m" },
);
const readOtpProof = (token, challenge, purpose) => {
  try {
    const proof = jwt.verify(token, env.accessSecret);
    return proof.type === "phone-otp" && proof.challengeId === challenge.id && proof.phoneNumber === challenge.phoneNumber && proof.purpose === purpose;
  } catch { return false; }
};
const publicUser = (user, authorization = {}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: authorization.role || user.role,
  roles: authorization.roles || [user.role],
  permissions: authorization.permissions || [],
});
// Access tokens are short lived. The longer-lived refresh token stays in an HTTP-only cookie.
const issue = async (user, res) => {
  const authorization = await getAuthorization(user.id);
  const accessToken = jwt.sign(
    { sub: user.id, role: authorization.role },
    env.accessSecret,
    { expiresIn: "15m" },
  );
  const refresh = jwt.sign(
    { sub: user.id, type: "refresh" },
    env.refreshSecret,
    { expiresIn: "30d" },
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
export const optionallyAuthenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/, "");
  if (!token) return next();
  try {
    req.user = jwt.verify(token, env.accessSecret);
    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired access token"));
  }
};
export const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, "Insufficient permission"));
export const authRoutes = (router) => {
  router.post(
    "/auth/phone/otp",
    asyncHandler(async (req, res) => {
      const { purpose } = req.body;
      if (!["register", "reset"].includes(purpose))
        throw new ApiError(422, "OTP purpose must be register or reset");
      const phoneNumber = normalizeSriLankanMobile(req.body.phoneNumber);
      const existing = await db.User.findOne({ where: { phoneNumber } });
      if (purpose === "register" && existing) throw new ApiError(409, "A student account already uses this mobile number");
      if (purpose === "reset" && !existing) throw new ApiError(404, "No student account uses this mobile number");
      const latest = await db.PhoneOtpChallenge.findOne({ where: { phoneNumber, purpose }, order: [["createdAt", "DESC"]] });
      if (latest && latest.resendAvailableAt > new Date())
        throw new ApiError(429, "Please wait before requesting another code", { resendAfter: Math.ceil((latest.resendAvailableAt - Date.now()) / 1000) });
      const code = otpCode();
      const challenge = await db.PhoneOtpChallenge.create({ phoneNumber, purpose, codeHash: hash(code), expiresAt: new Date(Date.now() + OTP_TTL_MS), resendAvailableAt: new Date(Date.now() + OTP_RESEND_MS) });
      const config = assertSmsConfig();
      const gateway = await sendToMobitel({ sender: config.sender, recipient: phoneNumber, text: `A Plus ICT verification code: ${code}. It expires in 5 minutes.`, messageType: 0, contentType: "standard" }, config);
      if (!gateway.accepted) {
        await challenge.destroy();
        throw new ApiError(503, "SMS delivery service could not accept the verification code");
      }
      res.status(201).json({ data: { challengeId: challenge.id, resendAfter: 60, message: "Verification code sent" } });
    }),
  );
  router.post(
    "/auth/phone/verify",
    asyncHandler(async (req, res) => {
      const { challengeId, code } = req.body;
      if (!challengeId || !/^\d{6}$/.test(String(code || ""))) throw new ApiError(422, "A challenge ID and 6-digit code are required");
      const challenge = await db.PhoneOtpChallenge.findByPk(challengeId);
      if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) throw new ApiError(401, "The code is invalid or expired");
      if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, "Too many verification attempts; request a new code");
      await challenge.increment("attempts");
      if (!crypto.timingSafeEqual(Buffer.from(challenge.codeHash), Buffer.from(hash(String(code))))) throw new ApiError(401, "The code is invalid or expired");
      await challenge.update({ verifiedAt: new Date() });
      res.json({ data: { verificationToken: otpProof(challenge) } });
    }),
  );
  router.post(
    "/auth/phone/register",
    asyncHandler(async (req, res) => {
      const { challengeId, verificationToken, password } = req.body;
      const name = String(req.body.name || "").trim();
      if (!name || name.length > 120 || !passwordIsValid(password)) throw new ApiError(422, "Name and a password of 8-72 bytes containing a letter and number are required");
      const challenge = await db.PhoneOtpChallenge.findByPk(challengeId);
      if (!challenge || challenge.purpose !== "register" || !challenge.verifiedAt || challenge.consumedAt || challenge.expiresAt < new Date() || !readOtpProof(verificationToken, challenge, "register")) throw new ApiError(401, "Phone verification is invalid or expired");
      const user = await db.sequelize.transaction(async (transaction) => {
        const duplicate = await db.User.findOne({ where: { phoneNumber: challenge.phoneNumber }, transaction });
        if (duplicate) throw new ApiError(409, "A student account already uses this mobile number");
        const student = await db.User.create({ name, phoneNumber: challenge.phoneNumber, passwordHash: await bcrypt.hash(password, 12), role: "student" }, { transaction });
        await db.StudentProfile.create({ userId: student.id, fullName: name, mobileNumber: challenge.phoneNumber, preferredMedium: "sinhala" }, { transaction });
        const studentRole = await db.Role.findOne({ where: { code: "student" }, transaction });
        if (studentRole) await db.UserRole.create({ userId: student.id, roleId: studentRole.id }, { transaction });
        await challenge.update({ consumedAt: new Date() }, { transaction });
        return student;
      });
      res.status(201).json({ data: await issue(user, res) });
    }),
  );
  router.post(
    "/auth/phone/login",
    asyncHandler(async (req, res) => {
      const phoneNumber = normalizeSriLankanMobile(req.body.phoneNumber);
      const user = await db.User.findOne({ where: { phoneNumber } });
      if (!user || user.status === "disabled" || !user.passwordHash || !(await bcrypt.compare(req.body.password || "", user.passwordHash))) throw new ApiError(401, "Invalid mobile number or password");
      res.json({ data: await issue(user, res) });
    }),
  );
  router.post(
    "/auth/phone/reset-password",
    asyncHandler(async (req, res) => {
      const { challengeId, verificationToken, password } = req.body;
      if (!passwordIsValid(password)) throw new ApiError(422, "Use a password of 8-72 bytes containing a letter and number");
      const challenge = await db.PhoneOtpChallenge.findByPk(challengeId);
      if (!challenge || challenge.purpose !== "reset" || !challenge.verifiedAt || challenge.consumedAt || challenge.expiresAt < new Date() || !readOtpProof(verificationToken, challenge, "reset")) throw new ApiError(401, "Phone verification is invalid or expired");
      await db.sequelize.transaction(async (transaction) => {
        const user = await db.User.findOne({ where: { phoneNumber: challenge.phoneNumber }, transaction });
        if (!user) throw new ApiError(404, "No student account uses this mobile number");
        await user.update({ passwordHash: await bcrypt.hash(password, 12) }, { transaction });
        await db.RefreshToken.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null }, transaction });
        await challenge.update({ consumedAt: new Date() }, { transaction });
      });
      res.json({ data: { ok: true } });
    }),
  );
  // Admin credentials are platform-managed.
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
  router.get(
    "/auth/google",
    asyncHandler(async (req, res) => {
      // A server-side OAuth flow must have all three values. Checking them
      // together prevents a confusing Google token-exchange failure later.
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.GOOGLE_CALLBACK_URL
      )
        throw new ApiError(501, "Google login is not configured");
      // Bind the OAuth callback to the initiating browser and prevent CSRF.
      const state = crypto.randomUUID();
      res.cookie("aplus_google_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: env.nodeEnv === "production",
        path: "/api/v1/auth",
      });
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
      url.searchParams.set("redirect_uri", process.env.GOOGLE_CALLBACK_URL);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set("state", state);
      res.redirect(url.toString());
    }),
  );
  router.get(
    "/auth/google/callback",
    asyncHandler(async (req, res) => {
      if (
        !process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.GOOGLE_CALLBACK_URL
      )
        throw new ApiError(501, "Google login is not configured");
      if (req.query.state !== req.cookies.aplus_google_state)
        throw new ApiError(401, "Invalid OAuth state");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_CALLBACK_URL,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok)
        throw new ApiError(401, "Google token exchange failed");
      // Ask Google's OpenID endpoint for the verified profile instead of trusting
      // a locally decoded ID token whose signature has not been checked here.
      const profileResponse = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } },
      );
      const profile = await profileResponse.json();
      if (
        !profileResponse.ok ||
        !profile?.email ||
        !profile?.sub ||
        profile.email_verified !== true
      ) {
        throw new ApiError(401, "A verified Google profile is required");
      }

      const user = await db.sequelize.transaction(async (transaction) => {
        let identity = await db.GoogleIdentity.findOne({
          where: { subject: profile.sub },
          transaction,
        });
        let currentUser = identity
          ? await db.User.findByPk(identity.userId, { transaction })
          : await db.User.findOne({
              where: { email: profile.email.toLowerCase() },
              transaction,
            });

        if (currentUser?.status === "disabled")
          throw new ApiError(401, "Account is unavailable");
        if (!currentUser) {
          currentUser = await db.User.create(
            {
              email: profile.email.toLowerCase(),
              name: profile.name || "Student",
              role: "student", // Compatibility field while role joins are adopted.
            },
            { transaction },
          );
          await db.StudentProfile.create(
            { userId: currentUser.id, preferredMedium: "sinhala" },
            { transaction },
          );
          const studentRole = await db.Role.findOne({
            where: { code: "student" },
            transaction,
          });
          if (studentRole) {
            await db.UserRole.create(
              { userId: currentUser.id, roleId: studentRole.id },
              { transaction },
            );
          }
        }
        if (!identity) {
          identity = await db.GoogleIdentity.create(
            {
              userId: currentUser.id,
              subject: profile.sub,
              emailAtLinkTime: profile.email.toLowerCase(),
            },
            { transaction },
          );
        } else {
          await identity.update(
            { emailAtLinkTime: profile.email.toLowerCase() },
            { transaction },
          );
        }
        return currentUser;
      });
      const result = await issue(user, res);
      res.redirect(
        `${process.env.WEB_LOGIN_SUCCESS_URL || "http://localhost:5173/login/success"}#access_token=${result.accessToken}`,
      );
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
