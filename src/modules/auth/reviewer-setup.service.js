import { ApiError } from "../../core/errors.js";
import { env } from "../../config/env.js";
import { db } from "../../models/index.js";

const reviewerProfile = {
  fullName: "PayHere Reviewer",
  dateOfBirth: "2000-01-01",
  address: "Review access account",
  city: "Colombo",
  mobileNumber: "0700000000",
  whatsAppNumber: "0700000000",
  gender: "prefer_not_to_say",
  schoolName: "PayHere Review",
  district: "Colombo",
  preferredMedium: "english",
  profileStatus: "complete",
  completedAt: new Date(),
};

export const setupReviewer = async ({ userOnly = false } = {}) => {
  if (!env.reviewLogin.email)
    throw new ApiError(422, "REVIEW_LOGIN_EMAIL must be configured");
  return db.sequelize.transaction(async (transaction) => {
    const [user] = await db.User.findOrCreate({
      where: { email: env.reviewLogin.email },
      defaults: { email: env.reviewLogin.email, name: "PayHere Reviewer", role: "student", status: "active" },
      transaction,
    });
    if (user.role !== "student") throw new ApiError(409, "Configured reviewer email belongs to a non-student account");
    if (user.status !== "active" || user.name !== "PayHere Reviewer")
      await user.update({ name: "PayHere Reviewer", status: "active" }, { transaction });

    const role = await db.Role.findOne({ where: { code: "student", isActive: true }, transaction });
    if (!role) throw new ApiError(503, "The student role has not been seeded");
    await db.UserRole.findOrCreate({ where: { userId: user.id, roleId: role.id }, defaults: { userId: user.id, roleId: role.id }, transaction });
    const [profile] = await db.StudentProfile.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id, ...reviewerProfile }, transaction });
    if (profile.profileStatus !== "complete" || !profile.fullName)
      await profile.update(reviewerProfile, { transaction });

    if (userOnly) return { user, courseTrackCount: 0, entitlementCount: 0 };
    const courseTracks = await db.CourseTrack.findAll({
      where: { status: "published", isPublic: true, availabilityStatus: "active" },
      transaction,
    });
    let entitlementCount = 0;
    for (const courseTrack of courseTracks) {
      const [enrolment] = await db.Enrolment.findOrCreate({
        where: { userId: user.id, courseTrackId: courseTrack.id },
        defaults: { userId: user.id, courseId: courseTrack.courseId, courseTrackId: courseTrack.id, status: "active", source: "manual", enrolledAt: new Date(), lastAccessedAt: new Date() },
        transaction,
      });
      if (enrolment.status !== "active" || enrolment.source !== "manual")
        await enrolment.update({ status: "active", source: "manual", unenrolledAt: null }, { transaction });

      const lessons = await db.Lesson.findAll({ where: { trackId: courseTrack.id, status: "published" }, transaction });
      for (const lesson of lessons) {
        const [entitlement] = await db.Entitlement.findOrCreate({
          where: { userId: user.id, sourceType: "admin", sourceId: user.id, lessonId: lesson.id, entitlementType: "lesson_premium_access" },
          defaults: { userId: user.id, entitlementType: "lesson_premium_access", courseId: courseTrack.courseId, courseTrackId: courseTrack.id, lessonId: lesson.id, status: "active", sourceType: "admin", sourceId: user.id, startsAt: new Date() },
          transaction,
        });
        if (entitlement.status !== "active") await entitlement.update({ status: "active", endsAt: null, revokedAt: null }, { transaction });
        entitlementCount += 1;
      }
    }
    return { user, courseTrackCount: courseTracks.length, entitlementCount };
  });
};
