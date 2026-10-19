import { db } from '../../models/index.js';
import { ApiError } from '../../core/errors.js';
import { publishedWhere } from '../content/content.service.js';
import { entitlementActive } from '../commerce/lesson-access-policy.js';

export const lessonEnrollmentActive = (row, date = new Date()) => Boolean(row && row.status === 'active' && new Date(row.enrolledAt) <= date);
export const getLessonEnrollment = (userId, lessonId, transaction) => db.LessonEnrolment.findOne({ where: { userId, lessonId }, transaction });
export const hasLessonEnrollment = async (userId, lessonId, transaction) => lessonEnrollmentActive(await getLessonEnrollment(userId, lessonId, transaction));

export const enrollLesson = async (userId, trackId, lessonSlug, transaction) => {
  if (typeof lessonSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lessonSlug)) throw new ApiError(422, 'A valid lesson slug is required');
  const lesson = await db.Lesson.findOne({ where: { trackId, slug: lessonSlug, ...publishedWhere() }, transaction });
  if (!lesson) throw new ApiError(404, 'Published lesson not found');
  const startedAt = new Date();
  const [row] = await db.LessonEnrolment.findOrCreate({ where: { userId, lessonId: lesson.id }, defaults: { userId, lessonId: lesson.id, courseTrackId: trackId, enrolledAt: startedAt, expiresAt: null, status: 'active' }, transaction });
  if (!lessonEnrollmentActive(row)) throw new ApiError(403, 'This lesson enrolment is inactive. Contact support.');
  return row;
};

export const myLessonEnrollments = async (userId) => {
  const rows = await db.LessonEnrolment.findAll({ where: { userId }, include: [db.Lesson, { model: db.CourseTrack, include: [db.Course, db.Medium] }], order: [['enrolledAt', 'DESC']] });
  const entitlements = await db.Entitlement.findAll({ where: { userId, entitlementType: 'lesson_premium_access', activityId: null }, order: [['startsAt', 'DESC']] });
  return rows.map((row) => {
    const lesson = row.Lesson, track = row.CourseTrack;
    const available = lesson && track && lesson.status === 'published' && lesson.isVisible !== false && track.status === 'published' && track.isPublic && track.availabilityStatus === 'active' && track.Course?.status === 'published' && track.Course?.isPublic;
    const active = lessonEnrollmentActive(row);
    const grants = entitlements.filter((entry) => entry.lessonId === row.lessonId && (!entry.courseTrackId || entry.courseTrackId === row.courseTrackId));
    const fullAccess = active && grants.some((entry) => entitlementActive(entry));
    const purchase = grants.find((entry) => entry.sourceType === 'order' && entitlementActive(entry)) || grants.find((entry) => entry.sourceType === 'order' && ['active', 'expired'].includes(entry.status));
    return { id: row.id, lessonId: row.lessonId, courseTrackId: row.courseTrackId, courseTitle: track?.Course?.titleEn || track?.Course?.title || track?.title, courseSlug: track?.slug, lessonTitle: lesson?.title, lessonSlug: lesson?.slug, lessonNumber: lesson?.lessonNumber, medium: track?.Medium?.nameEn || track?.Medium?.name || track?.Medium?.code, enrolledAt: row.enrolledAt, expiresAt: null, purchasedAt: purchase?.startsAt || null, accessUntil: purchase?.endsAt || null, fullAccess: Boolean(fullAccess), purchasedAccessExpired: Boolean(purchase?.endsAt && new Date(purchase.endsAt) <= new Date() && !fullAccess), status: row.status, availabilityStatus: available ? 'active' : 'unavailable', canLearn: Boolean(active && available) };
  });
};
