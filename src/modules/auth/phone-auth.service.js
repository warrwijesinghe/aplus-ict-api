import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { db } from "../../models/index.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../core/errors.js";
import { assertSmsConfig } from "../sms/sms.config.js";
import { sendToMobitel } from "../sms/sms.service.js";

const OTP_TTL = 5 * 60_000;
const WINDOW = 60 * 60_000;
const digest = (value) => crypto.createHmac("sha256", env.accessSecret).update(value).digest("hex");
const equalHash = (a, b) => typeof a === "string" && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const normalizeLoginPhone = (value) => {
  if (typeof value !== "string" || value.length > 30) throw new ApiError(422, "Enter a valid Sri Lankan mobile number.");
  let phone = value.trim().replace(/[\s()-]/g, "").replace(/^\+/, "");
  if (/^07\d{8}$/.test(phone)) phone = `94${phone.slice(1)}`;
  if (!/^947\d{8}$/.test(phone)) throw new ApiError(422, "Enter a Sri Lankan mobile number such as 0771234567.");
  return phone;
};
export const validatePassword = (value) => {
  if (typeof value !== "string" || value.length < 8 || Buffer.byteLength(value, "utf8") > 72 || !/[A-Za-z]/.test(value) || !/\d/.test(value))
    throw new ApiError(422, "Use at least 8 characters including a letter and a number, up to 72 bytes.");
  return value;
};
const validatePurpose = (purpose) => {
  if (!["register", "reset"].includes(purpose)) throw new ApiError(422, "Invalid verification purpose.");
  return purpose;
};
const invalidCode = () => new ApiError(422, "The code is invalid or expired. Request a new code if needed.");
const invalidVerification = () => new ApiError(422, "Phone verification has expired. Request a new code.");

// Inject delivery only for tests. OTPs never enter the admin SMS outbox or logs.
export const createPhoneAuthService = ({ models = db, deliver = sendToMobitel, smsConfig = assertSmsConfig, now = () => new Date() } = {}) => {
  const studentForPhone = async (phoneNumber, transaction) => {
    const user = await models.User.findOne({ where: { phoneNumber }, transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!user || user.role !== "student" || user.status !== "active") return null;
    const staffRoles = await models.UserRole.findAll({ where: { userId: user.id }, include: [{ model: models.Role, where: { code: ["admin", "super_admin", "teacher", "content_editor"] } }], transaction });
    return staffRoles.length ? null : user;
  };

  const requestOtp = async ({ phoneNumber: input, purpose: suppliedPurpose } = {}) => {
    const phoneNumber = normalizeLoginPhone(input), purpose = validatePurpose(suppliedPurpose);
    const config = smsConfig();
    const time = now(), challengeId = crypto.randomUUID();
    const code = crypto.randomInt(100000, 1000000).toString();
    // A unique phone/purpose row serializes resends across API instances.
    await models.PhoneChallenge.findOrCreate({ where: { phoneNumber, purpose }, defaults: { phoneNumber, purpose } });
    await models.sequelize.transaction(async (transaction) => {
      const row = await models.PhoneChallenge.findOne({ where: { phoneNumber, purpose }, transaction, lock: transaction.LOCK.UPDATE });
      const inWindow = row.windowStartedAt && time - row.windowStartedAt < WINDOW;
      if ((row.sentAt && time - row.sentAt < 60_000) || (inWindow && row.sendCount >= 5))
        throw new ApiError(429, "Too many verification requests. Wait before requesting another code.");
      await row.update({ challengeId, codeHash: null, verificationHash: null, verifiedAt: null, consumedAt: null,
        attempts: 0, expiresAt: new Date(time.getTime() + OTP_TTL), sentAt: time,
        windowStartedAt: inWindow ? row.windowStartedAt : time, sendCount: inWindow ? row.sendCount + 1 : 1 }, { transaction });
    });
    const existing = await models.User.findOne({ where: { phoneNumber } });
    const eligible = purpose === "register" ? !existing : Boolean(await studentForPhone(phoneNumber));
    if (eligible) {
      try {
        const result = await deliver({ contentType: "standard", recipient: phoneNumber, sender: config.sender, messageType: 0,
          text: `A Plus ICT: Your ${purpose === "reset" ? "password reset" : "phone verification"} code is ${code}. Valid for 5 minutes. Do not share this code.` }, config);
        if (!result.accepted) throw new Error("SMS rejected");
        await models.PhoneChallenge.update({ codeHash: digest(`${challengeId}:${purpose}:${phoneNumber}:${code}`) }, { where: { challengeId } });
      } catch {
        await models.PhoneChallenge.update({ codeHash: null, consumedAt: now() }, { where: { challengeId } });
        throw new ApiError(503, "The SMS could not be sent. Please try again later.");
      }
    }
    // Same response for existing/missing accounts, without exposing their status.
    return { challengeId, expiresIn: 300, resendAfter: 60, message: "If this number is eligible, a verification code has been sent." };
  };

  const verifyOtp = async ({ challengeId, code } = {}) => {
    if (typeof challengeId !== "string" || !/^[\da-f-]{36}$/i.test(challengeId) || typeof code !== "string" || !/^\d{6}$/.test(code)) throw invalidCode();
    const result = await models.sequelize.transaction(async (transaction) => {
      const row = await models.PhoneChallenge.findOne({ where: { challengeId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row || !row.codeHash || row.consumedAt || row.verifiedAt || row.expiresAt <= now() || row.attempts >= 5) return null;
      // Commit incorrect attempts rather than rolling them back with an exception.
      await row.update({ attempts: row.attempts + 1 }, { transaction });
      if (!equalHash(row.codeHash, digest(`${challengeId}:${row.purpose}:${row.phoneNumber}:${code}`))) return null;
      const verificationToken = crypto.randomBytes(32).toString("hex");
      await row.update({ codeHash: null, verifiedAt: now(), verificationHash: digest(verificationToken), expiresAt: new Date(now().getTime() + 10 * 60_000) }, { transaction });
      return { verificationToken, expiresIn: 600 };
    });
    if (!result) throw invalidCode();
    return result;
  };

  const complete = async ({ challengeId, verificationToken, password, name } = {}, purpose) => {
    validatePassword(password);
    if (typeof challengeId !== "string" || !/^[\da-f-]{36}$/i.test(challengeId) || typeof verificationToken !== "string" || !/^[\da-f]{64}$/i.test(verificationToken)) throw invalidVerification();
    if (purpose === "register" && (typeof name !== "string" || !name.trim() || name.trim().length > 120)) throw new ApiError(422, "Enter your full name (up to 120 characters).");
    const passwordHash = await bcrypt.hash(password, 12);
    return models.sequelize.transaction(async (transaction) => {
      const row = await models.PhoneChallenge.findOne({ where: { challengeId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!row || row.purpose !== purpose || !row.verifiedAt || row.consumedAt || row.expiresAt <= now() || !equalHash(row.verificationHash, digest(verificationToken))) throw invalidVerification();
      let user;
      if (purpose === "register") {
        if (await models.User.findOne({ where: { phoneNumber: row.phoneNumber }, transaction })) throw invalidVerification();
        user = await models.User.create({ phoneNumber: row.phoneNumber, phoneVerifiedAt: now(), name: name.trim(), passwordHash, role: "student", status: "active" }, { transaction });
        await models.StudentProfile.create({ userId: user.id, fullName: name.trim(), mobileNumber: `0${row.phoneNumber.slice(2)}`, preferredMedium: "sinhala" }, { transaction });
        const role = await models.Role.findOne({ where: { code: "student", isActive: true }, transaction });
        if (!role) throw new ApiError(503, "Student registration is temporarily unavailable.");
        await models.UserRole.create({ userId: user.id, roleId: role.id }, { transaction });
      } else {
        user = await studentForPhone(row.phoneNumber, transaction);
        if (!user) throw invalidVerification();
        await user.update({ passwordHash, phoneVerifiedAt: now(), authVersion: (user.authVersion || 0) + 1 }, { transaction });
        await models.RefreshToken.update({ revokedAt: now() }, { where: { userId: user.id, revokedAt: null }, transaction });
      }
      await row.update({ consumedAt: now(), verificationHash: null }, { transaction });
      return user;
    });
  };

  const login = async ({ phoneNumber, password } = {}) => {
    const phone = normalizeLoginPhone(phoneNumber);
    if (typeof password !== "string" || !password || Buffer.byteLength(password, "utf8") > 72) throw new ApiError(401, "Invalid phone number or password.");
    await models.PhoneChallenge.findOrCreate({ where: { phoneNumber: phone, purpose: "login" }, defaults: { phoneNumber: phone, purpose: "login" } });
    await models.sequelize.transaction(async (transaction) => {
      const row = await models.PhoneChallenge.findOne({ where: { phoneNumber: phone, purpose: "login" }, transaction, lock: transaction.LOCK.UPDATE });
      const inWindow = row.windowStartedAt && now() - row.windowStartedAt < 15 * 60_000;
      if (inWindow && row.attempts >= 15) throw new ApiError(429, "Too many sign-in attempts. Try again in 15 minutes.");
      await row.update({ windowStartedAt: inWindow ? row.windowStartedAt : now(), attempts: inWindow ? row.attempts + 1 : 1 }, { transaction });
    });
    const user = await studentForPhone(phone);
    // Always perform a password comparison to limit account enumeration by timing.
    const valid = await bcrypt.compare(password, user?.passwordHash || "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxKMlF51EM7DsnMUjVXjsXeNJka");
    if (!user || !user.phoneVerifiedAt || !user.passwordHash || !valid) throw new ApiError(401, "Invalid phone number or password.");
    return user;
  };
  return { requestOtp, verifyOtp, register: (input) => complete(input, "register"), resetPassword: (input) => complete(input, "reset"), login };
};

export const phoneAuth = createPhoneAuthService();
