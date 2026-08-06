import { Op } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { hasCourseAssignment, privilegedRoles } from "../../security/authorization.js";
import { profileView } from "./student-profile.service.js";
import { courseState, learningHistory } from "./student-learning.service.js";
import { gradebookForStudent, progressForCourse } from "../learning/completion-gradebook.service.js";

const isPrivileged = (user) => privilegedRoles.has(user.role);
const studentScope = async (user, studentId, trackId = null, capability = "canViewStudents") => {
  if (isPrivileged(user)) return;
  if (!trackId) throw new ApiError(403, "A course assignment is required to view this student");
  const track = await db.CourseTrack.findByPk(trackId);
  if (!track || !(await hasCourseAssignment(user.sub, { trackId, courseId: track.courseId, capability }))) throw new ApiError(403, "You are not assigned to this Medium");
};
const courseView = (track) => ({ id: track.id, title: track.title, slug: track.slug, medium: track.Medium?.code || null, academicLevel: track.Course?.academicLevel || track.Course?.courseGroup || null });

export const listStudents = async (user, query = {}) => {
  if (!isPrivileged(user)) throw new ApiError(403, "Administrators can search all students; teachers must use an assigned Medium detail view");
  const page = Math.max(Number(query.page) || 1, 1); const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
  const profileWhere = {}; const userWhere = { role: "student" };
  if (query.search) userWhere[Op.or] = [{ name: { [Op.like]: `%${String(query.search).slice(0, 100)}%` } }, { email: { [Op.like]: `%${String(query.search).slice(0, 100)}%` } }];
  for (const key of ["district", "preferredMedium"]) if (query[key]) profileWhere[key] = query[key];
  if (query.gradeOrExamYear) profileWhere.examYear = Number(query.gradeOrExamYear);
  if (query.profileStatus) profileWhere.profileStatus = query.profileStatus;
  const include = [{ model: db.StudentProfile, where: Object.keys(profileWhere).length ? profileWhere : undefined, required: Boolean(Object.keys(profileWhere).length) }, { model: db.Enrolment, where: { status: "active" }, required: query.hasEnrolment === "true", attributes: ["id", "lastAccessedAt"] }];
  const { rows, count } = await db.User.findAndCountAll({ where: userWhere, include, distinct: true, limit: pageSize, offset: (page - 1) * pageSize, order: [[query.sort === "name" ? "name" : "createdAt", query.direction === "asc" ? "ASC" : "DESC"]] });
  return { items: rows.map((student) => ({ id: student.id, fullName: student.StudentProfile?.fullName || student.name, email: student.email, mobileNumber: student.StudentProfile?.mobileNumber || null, schoolName: student.StudentProfile?.schoolName || null, district: student.StudentProfile?.district || null, gradeOrExamYear: student.StudentProfile?.examYear || null, preferredMedium: student.StudentProfile?.preferredMedium || null, profileStatus: student.StudentProfile?.profileStatus || "incomplete", activeEnrolmentCount: student.Enrolments?.length || 0, lastActivityAt: student.Enrolments?.reduce((latest, row) => !latest || row.lastAccessedAt > latest ? row.lastAccessedAt : latest, null) || null, accountStatus: student.status })), pagination: { page, pageSize, total: count } };
};

export const studentDetail = async (user, studentId, trackId = null) => {
  await studentScope(user, studentId, trackId);
  const student = await db.User.findOne({ where: { id: studentId, role: "student" }, include: [db.StudentProfile] }); if (!student) throw new ApiError(404, "Student not found");
  const enrolments = await db.Enrolment.findAll({ where: { userId: studentId }, include: [{ model: db.CourseTrack, include: [db.Course, db.Medium] }], order: [["enrolledAt", "DESC"]] });
  if (!isPrivileged(user)) {
    const allowed = []; for (const entry of enrolments) { try { await studentScope(user, studentId, entry.courseTrackId); allowed.push(entry); } catch { /* scoped out */ } }
    if (!allowed.length) throw new ApiError(404, "Student not found");
    return studentDetailView(student, allowed, studentId);
  }
  return studentDetailView(student, enrolments, studentId);
};
const studentDetailView = async (student, enrolments, studentId) => ({ id: student.id, email: student.email, accountStatus: student.status, profile: profileView(student.StudentProfile), enrolments: await Promise.all(enrolments.map(async (entry) => ({ id: entry.id, status: entry.status, enrolmentType: entry.source === "manual" ? "admin" : entry.source, enrolledAt: entry.enrolledAt, unenrolledAt: entry.unenrolledAt, course: courseView(entry.CourseTrack), progress: await progressForCourse(studentId, entry.courseTrackId).then((item) => item.course), state: await courseState(studentId, entry.courseTrackId) }))) });

export const updateAdminEnrolment = async (user, studentId, body) => db.sequelize.transaction(async (transaction) => {
  const track = await db.CourseTrack.findByPk(body.courseTrackId, { include: [db.Course, db.Medium], transaction });
  if (!track || track.status !== "published" || track.availabilityStatus !== "active") throw new ApiError(422, "A published active Medium is required");
  await studentScope(user, studentId, track.id, "canViewStudents");
  const source = body.enrolmentType === "free" ? "free" : "manual";
  const [entry, created] = await db.Enrolment.findOrCreate({ where: { userId: studentId, courseTrackId: track.id }, defaults: { userId: studentId, courseTrackId: track.id, status: "active", source, enrolledAt: new Date(), createdByUserId: user.sub }, transaction });
  if (!created) await entry.update({ status: "active", source, unenrolledAt: null, createdByUserId: user.sub }, { transaction });
  await db.StudentLearningHistory.create({ userId: studentId, courseTrackId: track.id, eventType: "course_enrolled", occurredAt: new Date(), metadata: { source: source === "manual" ? "admin" : "free" } }, { transaction });
  return { id: entry.id, status: entry.status, enrolmentType: source === "manual" ? "admin" : source, course: courseView(track) };
});

export const changeAdminEnrolment = async (user, enrolmentId, status) => {
  const entry = await db.Enrolment.findByPk(enrolmentId); if (!entry) throw new ApiError(404, "Enrolment not found");
  await studentScope(user, entry.userId, entry.courseTrackId, "canViewStudents");
  if (!["active", "inactive", "cancelled"].includes(status)) throw new ApiError(422, "Invalid enrolment status");
  await entry.update({ status, unenrolledAt: status === "active" ? null : new Date() });
  return { id: entry.id, status: entry.status, unenrolledAt: entry.unenrolledAt };
};

export const studentProgress = async (user, studentId, trackId) => { await studentScope(user, studentId, trackId); return progressForCourse(studentId, trackId); };
export const studentResults = async (user, studentId, trackId) => { await studentScope(user, studentId, trackId); return gradebookForStudent(studentId, trackId, { teacher: true }); };
export const studentHistory = async (user, studentId, options) => { await studentScope(user, studentId, options.courseTrackId); return learningHistory(studentId, options); };
