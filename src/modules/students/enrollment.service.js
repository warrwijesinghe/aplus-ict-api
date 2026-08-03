import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";

const trackInclude = [
  { model: db.Course, where: { status: "published", isPublic: true }, include: [db.AcademicLevel] },
  db.Medium,
];

const enrollmentWhere = { status: "published", isPublic: true, availabilityStatus: "active", enrolmentOpen: true };

export const enrollmentView = (enrollment) => ({
  ...enrollment.toJSON(),
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
    where: { userId, courseTrackId }, include: [{ model: db.CourseTrack, include: trackInclude }],
  });
  return enrollment ? enrollmentView(enrollment) : null;
};

export const enrollStudent = async (userId, courseTrackId) => db.sequelize.transaction(async (transaction) => {
  const track = await db.CourseTrack.findOne({ where: { id: courseTrackId, ...enrollmentWhere }, include: trackInclude, transaction });
  if (!track) throw new ApiError(404, "An open published course was not found");
  const [enrollment] = await db.Enrolment.findOrCreate({
    where: { userId, courseTrackId }, defaults: { userId, courseTrackId, status: "active", source: "free", enrolledAt: new Date(), lastAccessedAt: new Date() }, transaction,
  });
  if (!enrollment.isNewRecord && !enrollment.lastAccessedAt) await enrollment.update({ lastAccessedAt: new Date() }, { transaction });
  const hydrated = await db.Enrolment.findByPk(enrollment.id, { include: [{ model: db.CourseTrack, include: trackInclude }], transaction });
  return enrollmentView(hydrated);
});

export const touchEnrollment = (userId, courseTrackId) =>
  db.Enrolment.update({ lastAccessedAt: new Date() }, { where: { userId, courseTrackId, status: "active" } });
