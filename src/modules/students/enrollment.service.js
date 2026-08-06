import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { requireCompletedProfile } from "./student-profile.service.js";

const trackInclude = [
  { model: db.Course, where: { status: "published", isPublic: true }, include: [db.AcademicLevel] },
  db.Medium,
];

const enrollmentWhere = { status: "published", isPublic: true, availabilityStatus: "active", enrolmentOpen: true };

export const enrollmentView = (enrollment) => ({
  id: enrollment.id, courseTrackId: enrollment.courseTrackId, status: enrollment.status, enrolmentType: enrollment.source === "manual" ? "admin" : enrollment.source, enrolledAt: enrollment.enrolledAt, unenrolledAt: enrollment.unenrolledAt || null, lastAccessedAt: enrollment.lastAccessedAt || null,
  course: enrollment.CourseTrack ? {
    id: enrollment.CourseTrack.id,
    slug: enrollment.CourseTrack.slug,
    title: enrollment.CourseTrack.title,
    medium: enrollment.CourseTrack.Medium,
    academicArea: enrollment.CourseTrack.Course?.courseGroup,
  } : null,
});

export const listEnrollments = async (userId) => {
  const rows = await db.Enrolment.findAll({
    where: { userId, status: "active" }, include: [{ model: db.CourseTrack, include: trackInclude }],
    order: [["lastAccessedAt", "DESC"], ["enrolledAt", "DESC"]],
  });
  return rows.map(enrollmentView);
};

export const getEnrollment = async (userId, courseTrackId) => {
  const enrollment = await db.Enrolment.findOne({
    where: { userId, courseTrackId, status: "active" }, include: [{ model: db.CourseTrack, include: trackInclude }],
  });
  return enrollment ? enrollmentView(enrollment) : null;
};

export const enrollStudent = async (userId, courseTrackId) => db.sequelize.transaction(async (transaction) => {
  await requireCompletedProfile(userId);
  const track = await db.CourseTrack.findOne({ where: { id: courseTrackId, ...enrollmentWhere }, include: trackInclude, transaction });
  if (!track) throw new ApiError(404, "An open published course was not found");
  const [enrollment, created] = await db.Enrolment.findOrCreate({
    where: { userId, courseTrackId }, defaults: { userId, courseTrackId, status: "active", source: "free", enrolledAt: new Date(), lastAccessedAt: new Date() }, transaction,
  });
  if (!created && enrollment.status !== "active") await enrollment.update({ status: "active", source: "free", enrolledAt: enrollment.enrolledAt || new Date(), unenrolledAt: null }, { transaction });
  if (!created && !enrollment.lastAccessedAt) await enrollment.update({ lastAccessedAt: new Date() }, { transaction });
  if (created) await db.StudentLearningHistory.create({ userId, courseTrackId, eventType: "course_enrolled", occurredAt: new Date(), metadata: { source: "free" } }, { transaction });
  const hydrated = await db.Enrolment.findByPk(enrollment.id, { include: [{ model: db.CourseTrack, include: trackInclude }], transaction });
  return enrollmentView(hydrated);
});

export const unenrollStudent = async (userId, courseTrackId) => db.sequelize.transaction(async (transaction) => {
  const enrollment = await db.Enrolment.findOne({ where: { userId, courseTrackId, status: "active" }, transaction });
  if (!enrollment) throw new ApiError(404, "An active course enrollment was not found");
  await enrollment.update({ status: "cancelled", unenrolledAt: new Date() }, { transaction });
  return enrollmentView(enrollment);
});

export const touchEnrollment = (userId, courseTrackId) =>
  db.Enrolment.update({ lastAccessedAt: new Date() }, { where: { userId, courseTrackId, status: "active" } });
