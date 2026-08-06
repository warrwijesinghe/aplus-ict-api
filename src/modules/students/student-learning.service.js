import { Op } from "sequelize";
import { db } from "../../models/index.js";
import { progressForCourse, gradebookForStudent } from "../learning/completion-gradebook.service.js";
import { continueLearning } from "../learning/student-player.service.js";

export const recordLearningEvent = async (values, transaction) => {
  const recent = await db.StudentLearningHistory.findOne({ where: { userId: values.userId, courseTrackId: values.courseTrackId, activityId: values.activityId || null, quizAttemptId: values.quizAttemptId || null, eventType: values.eventType, occurredAt: { [Op.gt]: new Date(Date.now() - 30_000) } }, transaction, order: [["occurredAt", "DESC"]] });
  if (!recent) await db.StudentLearningHistory.create({ ...values, metadata: values.metadata || null }, { transaction });
};

export const recordAuthorizedActivityAccess = async ({ userId, courseTrackId, lessonId, topicId, activityId, transaction }) => {
  const now = new Date();
  const [state] = await db.StudentCourseState.findOrCreate({ where: { userId, courseTrackId }, defaults: { userId, courseTrackId, lastLessonId: lessonId, lastTopicId: topicId || null, lastActivityId: activityId, lastAccessedAt: now }, transaction });
  if (!state.isNewRecord) await state.update({ lastLessonId: lessonId, lastTopicId: topicId || null, lastActivityId: activityId, lastAccessedAt: now }, { transaction });
  await recordLearningEvent({ userId, courseTrackId, lessonId, topicId, activityId, eventType: "activity_opened", occurredAt: now }, transaction);
};

export const learningHistory = async (userId, { page = 1, pageSize = 20, courseTrackId } = {}) => {
  const limit = Math.min(Math.max(Number(pageSize) || 20, 1), 100); const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const { rows, count } = await db.StudentLearningHistory.findAndCountAll({ where: { userId, ...(courseTrackId ? { courseTrackId } : {}) }, order: [["occurredAt", "DESC"]], limit, offset, include: [{ model: db.CourseTrack, include: [db.Course, db.Medium] }] });
  return { items: rows.map((event) => ({ id: event.id, eventType: event.eventType, occurredAt: event.occurredAt, courseTrackId: event.courseTrackId, lessonId: event.lessonId, topicId: event.topicId, activityId: event.activityId, quizId: event.quizId, quizAttemptId: event.quizAttemptId, course: event.CourseTrack ? { title: event.CourseTrack.title, slug: event.CourseTrack.slug, medium: event.CourseTrack.Medium?.code || null } : null })), pagination: { page: Math.max(Number(page) || 1, 1), pageSize: limit, total: count } };
};

export const courseState = async (userId, courseTrackId) => {
  const state = await db.StudentCourseState.findOne({ where: { userId, courseTrackId } });
  return state ? { courseTrackId, lastLessonId: state.lastLessonId, lastTopicId: state.lastTopicId, lastActivityId: state.lastActivityId, lastAccessedAt: state.lastAccessedAt } : { courseTrackId, lastLessonId: null, lastTopicId: null, lastActivityId: null, lastAccessedAt: null };
};

export const dashboard = async (userId) => {
  const enrollments = await db.Enrolment.findAll({ where: { userId, status: "active" }, include: [{ model: db.CourseTrack, include: [db.Course, db.Medium] }], order: [["lastAccessedAt", "DESC"]] });
  const courses = await Promise.all(enrollments.map(async (enrolment) => {
    const track = enrolment.CourseTrack; const progress = await progressForCourse(userId, track.id); const state = await courseState(userId, track.id);
    const continuation = await continueLearning(userId, track.slug);
    return { enrolmentId: enrolment.id, courseTrackId: track.id, slug: track.slug, title: track.title, academicLevel: track.Course?.academicLevel || track.Course?.courseGroup || null, medium: track.Medium?.code || null, enrolmentType: enrolment.source === "manual" ? "admin" : enrolment.source, status: enrolment.status, enrolledAt: enrolment.enrolledAt, lastLearningAt: state.lastAccessedAt || enrolment.lastAccessedAt, lastAccessedActivityId: state.lastActivityId, progress: progress.course, continueLearning: continuation.target };
  }));
  const recentHistory = await learningHistory(userId, { pageSize: 8 });
  const results = (await Promise.all(courses.map(async (course) => (await gradebookForStudent(userId, course.courseTrackId)).quizzes.map((quiz) => ({ ...quiz, courseTrackId: course.courseTrackId, courseTitle: course.title }))))).flat();
  return { courses, continueLearning: courses.find((course) => course.continueLearning) || null, recentLearning: recentHistory.items, recentQuizResults: results.filter((result) => result.percentage !== undefined).slice(0, 5), pendingGrades: results.filter((result) => result.pendingManualGrading).slice(0, 5), assignmentResults: [] };
};
