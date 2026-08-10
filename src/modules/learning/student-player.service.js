import { Op } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { publishedWhere } from "../content/content.service.js";
import { serializeActivity } from "../content/activities/activity-serializer.js";
import { accessibleProgress } from "./progress.service.js";
import { accessState, clearManualCompletion, recordCompletion } from "./completion-gradebook.service.js";
import { requireCompletedProfile } from "../students/student-profile.service.js";
import { entitledLessonIds } from "../commerce/commerce.service.js";

const title = (row) => row.titleEn || row.title;
const activeTrackWhere = (slug) => ({
  slug,
  status: "published",
  isPublic: true,
  availabilityStatus: "active",
});

const assertEnrollment = async (userId, trackId, transaction) => {
  const enrollment = await db.Enrolment.findOne({
    where: { userId, courseTrackId: trackId, status: "active" },
    transaction,
  });
  if (!enrollment) throw new ApiError(403, "Course enrollment is required");
  return enrollment;
};

const courseIdentity = (track) => ({
  id: track.id,
  slug: track.slug,
  title: track.title,
  academicLevel: track.Course?.AcademicLevel
    ? { code: track.Course.AcademicLevel.code, name: track.Course.AcademicLevel.nameEn || track.Course.AcademicLevel.name }
    : null,
  medium: track.Medium ? { code: track.Medium.code, name: track.Medium.nameEn || track.Medium.name } : null,
});

const navActivity = (activity, progress, isLocked, access = null) => ({
  id: activity.id,
  type: activity.type,
  contentType: activity.type,
  title: title(activity),
  accessPolicy: ["premium", "paid"].includes(activity.accessPolicy) ? "premium" : "free",
  completionMode: activity.completionMode || "none",
  estimatedMinutes: activity.estimatedMinutes || null,
  sortOrder: activity.sortOrder,
  isLocked,
  accessState: access || { available: !isLocked, locked: isLocked, reasons: isLocked ? ["Course access is required."] : [], unmetRequirements: [] },
  progress: progress ? { status: progress.status, completedAt: progress.completedAt } : { status: "not_started", completedAt: null },
});

const activityCounts = (activities) => accessibleProgress(activities.map(({ activity, progress, isLocked }) => ({
  isLocked,
  completionMode: activity.completionMode,
  progress: progress ? { status: progress.status } : { status: "not_started" },
})));

/**
 * Loads just the published, enrolled student's course hierarchy.  Content is
 * deliberately not selected for this map; a separate detail request is needed
 * for the current activity so query caches never hold a whole course of text,
 * resource identifiers, or video configuration.
 */
export const loadStudentCourse = async (userId, courseSlug, transaction) => {
  await requireCompletedProfile(userId);
  const track = await db.CourseTrack.findOne({
    where: activeTrackWhere(courseSlug),
    include: [{ model: db.Course, where: { status: "published", isPublic: true }, include: [db.AcademicLevel] }, db.Medium],
    transaction,
  });
  if (!track) throw new ApiError(404, "Course not found");
  const enrollment = await assertEnrollment(userId, track.id, transaction);
  const lessons = await db.Lesson.findAll({ where: { trackId: track.id, ...publishedWhere() }, order: [["sortOrder", "ASC"]], transaction });
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [topics, activities] = await Promise.all([
    db.Topic.findAll({ where: { lessonId: { [Op.in]: lessonIds }, ...publishedWhere() }, order: [["sortOrder", "ASC"]], transaction }),
    db.LessonSection.findAll({
      where: { lessonId: { [Op.in]: lessonIds }, ...publishedWhere() },
      attributes: ["id", "lessonId", "topicId", "type", "title", "titleEn", "accessPolicy", "completionMode", "estimatedMinutes", "sortOrder"],
      order: [["sortOrder", "ASC"]],
      transaction,
    }),
  ]);
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  // A malformed row must not bridge an activity into a different lesson via
  // topicId. Treat it as invisible rather than trusting either foreign key.
  const visibleActivities = activities.filter((activity) => !activity.topicId || topicsById.get(activity.topicId)?.lessonId === activity.lessonId);
  const [progressRows, entitlementRows] = await Promise.all([
    db.ContentProgress.findAll({ where: { userId, lessonSectionId: { [Op.in]: visibleActivities.map((activity) => activity.id) } }, transaction }),
    entitledLessonIds(userId, lessonIds, transaction),
  ]);
  const progressByActivity = new Map(progressRows.map((item) => [item.lessonSectionId, item]));
  const entitledLessons = entitlementRows;
  const initialRows = visibleActivities.map((activity) => ({
    activity,
    progress: progressByActivity.get(activity.id),
    isLocked: ["premium", "paid"].includes(activity.accessPolicy) && !entitledLessons.has(activity.lessonId),
  }));
  const activityRows = await Promise.all(initialRows.map(async (row) => {
    const state = await accessState(userId, row.activity.id, transaction);
    return { ...row, isLocked: state.locked, access: state };
  }));
  const byLesson = new Map(lessons.map((lesson) => [lesson.id, []]));
  activityRows.forEach((row) => byLesson.get(row.activity.lessonId)?.push(row));
  const topicsByLesson = new Map(lessons.map((lesson) => [lesson.id, []]));
  topics.forEach((topic) => topicsByLesson.get(topic.lessonId)?.push(topic));

  const lessonMap = lessons.map((lesson) => {
    const lessonActivities = byLesson.get(lesson.id) || [];
    const lessonTopics = topicsByLesson.get(lesson.id) || [];
    const groups = lessonTopics.map((topic) => ({
      id: topic.id,
      title: title(topic),
      sortOrder: topic.sortOrder,
      activities: lessonActivities.filter((row) => row.activity.topicId === topic.id).map((row) => navActivity(row.activity, row.progress, row.isLocked, row.access)),
    }));
    const ungrouped = lessonActivities.filter((row) => !row.activity.topicId);
    if (ungrouped.length) groups.unshift({ id: `lesson-${lesson.id}-content`, title: "Lesson content", sortOrder: 0, activities: ungrouped.map((row) => navActivity(row.activity, row.progress, row.isLocked, row.access)) });
    return {
      id: lesson.id,
      slug: lesson.slug,
      lessonNumber: lesson.lessonNumber,
      title: title(lesson),
      summary: lesson.summary || null,
      sortOrder: lesson.sortOrder,
      topics: groups,
      progress: activityCounts(lessonActivities),
    };
  });
  const flatActivities = activityRows.sort((a, b) => {
    const lessonOrder = lessons.findIndex((lesson) => lesson.id === a.activity.lessonId) - lessons.findIndex((lesson) => lesson.id === b.activity.lessonId);
    if (lessonOrder) return lessonOrder;
    const topicOrder = (topics.findIndex((topic) => topic.id === a.activity.topicId) + 1) - (topics.findIndex((topic) => topic.id === b.activity.topicId) + 1);
    return topicOrder || a.activity.sortOrder - b.activity.sortOrder;
  });
  return { track, enrollment, lessons: lessonMap, activityRows: flatActivities, progress: activityCounts(flatActivities), progressByActivity };
};

const activityTarget = (row, lessons) => {
  const lesson = lessons.find((item) => item.id === row.activity.lessonId);
  return { lessonSlug: lesson?.slug || lesson?.id, activityId: row.activity.id, title: title(row.activity) };
};

export const playerCourseResponse = async (userId, courseSlug) => {
  const player = await loadStudentCourse(userId, courseSlug);
  return { course: courseIdentity(player.track), lessons: player.lessons, progress: player.progress };
};

export const activityPlayerResponse = async (userId, courseSlug, lessonSlug, activityId, { recordOpen = false } = {}) => db.sequelize.transaction(async (transaction) => {
  const player = await loadStudentCourse(userId, courseSlug, transaction);
  const currentIndex = player.activityRows.findIndex((row) => row.activity.id === activityId);
  const row = player.activityRows[currentIndex];
  const lesson = player.lessons.find((item) => item.slug === lessonSlug || item.id === lessonSlug);
  if (!row || !lesson || row.activity.lessonId !== lesson.id) throw new ApiError(404, "Activity not found");

  if (recordOpen && !row.isLocked) {
    const now = new Date();
    await player.enrollment.update({ lastAccessedAt: now, lastAccessedActivityId: row.activity.id }, { transaction });
    const [state] = await db.StudentCourseState.findOrCreate({ where: { userId, courseTrackId: player.track.id }, defaults: { userId, courseTrackId: player.track.id, lastLessonId: row.activity.lessonId, lastTopicId: row.activity.topicId || null, lastActivityId: row.activity.id, lastAccessedAt: now }, transaction });
    if (!state.isNewRecord) await state.update({ lastLessonId: row.activity.lessonId, lastTopicId: row.activity.topicId || null, lastActivityId: row.activity.id, lastAccessedAt: now }, { transaction });
    await db.StudentLearningHistory.create({ userId, courseTrackId: player.track.id, lessonId: row.activity.lessonId, topicId: row.activity.topicId || null, activityId: row.activity.id, eventType: "activity_opened", occurredAt: now }, { transaction });
    if (row.activity.completionMode === "view") {
      await recordCompletion(userId, row.activity.id, "view", null, transaction);
      await db.StudentLearningHistory.create({ userId, courseTrackId: player.track.id, lessonId: row.activity.lessonId, topicId: row.activity.topicId || null, activityId: row.activity.id, eventType: "activity_completed", occurredAt: now }, { transaction });
    }
  }
  const freshProgress = recordOpen && !row.isLocked
    ? await db.ContentProgress.findOne({ where: { userId, lessonSectionId: row.activity.id }, transaction })
    : row.progress;
  const detail = await db.LessonSection.findByPk(row.activity.id, { transaction });
  const current = row.isLocked
    ? navActivity(row.activity, freshProgress, true, row.access)
    : { ...serializeActivity(detail, "authorized_student"), progress: freshProgress ? { status: freshProgress.status, completedAt: freshProgress.completedAt } : { status: "not_started", completedAt: null } };
  if (!row.isLocked && detail.type === "quiz") {
    const quiz = await db.Quiz.findOne({ where: { lessonSectionId: detail.id }, attributes: ["id"], transaction });
    current.quizId = quiz?.id || null;
  }
  // Previous/Next follows the published lesson plan, including locked items.
  // A locked activity has its own unlock state in the player; silently skipping
  // it made learners jump into a later lesson without seeing the next item.
  const previous = player.activityRows[currentIndex - 1] || null;
  const next = player.activityRows[currentIndex + 1] || null;
  const updatedRows = player.activityRows.map((item) => item.activity.id === row.activity.id ? { ...item, progress: freshProgress } : item);
  return {
    course: courseIdentity(player.track),
    lessons: player.lessons,
    progress: activityCounts(updatedRows),
    current,
    previous: previous ? activityTarget(previous, player.lessons) : null,
    next: next ? activityTarget(next, player.lessons) : null,
  };
});

export const setManualCompletion = async (userId, courseSlug, lessonSlug, activityId, completed) => db.sequelize.transaction(async (transaction) => {
  const response = await activityPlayerResponse(userId, courseSlug, lessonSlug, activityId);
  if (response.current.isLocked) throw new ApiError(403, "Activity prerequisites are not met");
  if (response.current.completionMode !== "manual") throw new ApiError(422, "This activity does not support manual completion");
  if (completed) {
    await recordCompletion(userId, activityId, "manual", null, transaction);
    const activity = await db.LessonSection.findByPk(activityId, { transaction });
    const lesson = await db.Lesson.findByPk(activity.lessonId, { transaction });
    await db.StudentLearningHistory.create({ userId, courseTrackId: lesson.trackId, lessonId: activity.lessonId, topicId: activity.topicId || null, activityId, eventType: "activity_completed", occurredAt: new Date() }, { transaction });
  }
  else await clearManualCompletion(userId, activityId, transaction);
  return activityPlayerResponse(userId, courseSlug, lessonSlug, activityId);
});

export const continueLearning = async (userId, courseSlug) => {
  const player = await loadStudentCourse(userId, courseSlug);
  const accessible = player.activityRows.filter((row) => !row.isLocked);
  const state = await db.StudentCourseState.findOne({ where: { userId, courseTrackId: player.track.id } });
  const last = accessible.find((row) => row.activity.id === (state?.lastActivityId || player.enrollment.lastAccessedActivityId));
  const countableIncomplete = accessible.find((row) => row.activity.completionMode !== "none" && !["submit", "pass"].includes(row.activity.completionMode) && row.progress?.status !== "completed");
  const selected = last || countableIncomplete || accessible[0] || null;
  return { target: selected ? activityTarget(selected, player.lessons) : null, progress: player.progress };
};
