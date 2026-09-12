import { db } from "../src/models/index.js";
import { normalizeLoginPhone } from "../src/modules/auth/phone-auth.service.js";

// Run only after staff independently confirms the existing learner's identity.
// Assigning a number does not verify it: password reset by SMS must follow.
const [userId, inputPhone] = process.argv.slice(2);
try {
  if (!userId || !inputPhone) throw new Error("Usage: node scripts/assign-student-phone.js <student-user-id> <mobile-number>");
  const phoneNumber = normalizeLoginPhone(inputPhone);
  await db.sequelize.transaction(async (transaction) => {
    const user = await db.User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.role !== "student" || user.status !== "active") throw new Error("An active student account is required.");
    if (user.phoneNumber) throw new Error("This account already has a login phone. Use its password reset flow.");
    const staffRoles = await db.UserRole.findAll({ where: { userId }, include: [{ model: db.Role, where: { code: ["admin", "super_admin", "teacher", "content_editor"] } }], transaction });
    if (staffRoles.length) throw new Error("Staff accounts cannot use student phone login.");
    if (await db.User.findOne({ where: { phoneNumber }, transaction })) throw new Error("This phone number is already assigned.");
    await user.update({ phoneNumber, phoneVerifiedAt: null, passwordHash: null, authVersion: (user.authVersion || 0) + 1 }, { transaction });
    await db.RefreshToken.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null }, transaction });
  });
  console.info("Phone assigned. The student must verify it through Forgot password to set a password. Existing learning and purchases are preserved.");
} catch (error) {
  console.error(error.name === "SequelizeUniqueConstraintError" ? "This phone number is already assigned." : error.message);
  process.exitCode = 1;
} finally {
  await db.sequelize.close();
}
