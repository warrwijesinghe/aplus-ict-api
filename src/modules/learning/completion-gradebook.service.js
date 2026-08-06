import { Op } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { hasCourseAssignment, privilegedRoles } from "../../security/authorization.js";

export const PREREQUISITE_COMBINATION = "all";
const now = () => new Date();
const title = (row) => row?.titleEn || row?.title || "this activity";
const active = { status: "published", isVisible: { [Op.ne]: false } };
const percent = (done, total) => total ? Math.round((done / total) * 100) : 0;

const trackForActivity = async (activityId, transaction) => {
  const activity = await db.LessonSection.findByPk(activityId, { include: [{ model: db.Lesson, include: [db.CourseTrack] }, db.Topic], transaction });
  if (!activity?.Lesson?.CourseTrack) throw new ApiError(404, "Activity not found");
  return { activity, lesson: activity.Lesson, track: activity.Lesson.CourseTrack };
};

export const assertGradebookScope = async (user, trackId, capability = "canViewStudents") => {
  const track = await db.CourseTrack.findByPk(trackId);
  if (!track) throw new ApiError(404, "Medium not found");
  if (!privilegedRoles.has(user.role) && !(await hasCourseAssignment(user.sub, { trackId, courseId: track.courseId, capability }))) throw new ApiError(403, "You are not assigned to this Medium");
  return track;
};

const courseActivities = async (trackId, transaction) => {
  const lessons = await db.Lesson.findAll({ where: { trackId, ...active }, order: [["sortOrder", "ASC"]], transaction });
  const lessonIds = lessons.map((row) => row.id);
  const topics = await db.Topic.findAll({ where: { lessonId: { [Op.in]: lessonIds }, ...active }, order: [["sortOrder", "ASC"]], transaction });
  const validTopics = new Map(topics.map((row) => [row.id, row]));
  const activities = await db.LessonSection.findAll({ where: { lessonId: { [Op.in]: lessonIds }, ...active }, order: [["sortOrder", "ASC"]], transaction });
  return { lessons, topics, activities: activities.filter((row) => !row.topicId || validTopics.get(row.topicId)?.lessonId === row.lessonId) };
};

const entitlementLessons = async (userId, lessonIds, transaction) => new Set((await db.Entitlement.findAll({ where: { userId, lessonId: { [Op.in]: lessonIds }, status: "active", [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now() } }] }, transaction })).map((row) => row.lessonId));
const premiumLocked = (activity, entitled) => ["premium", "paid"].includes(activity.accessPolicy) && !entitled.has(activity.lessonId);

const gradeForQuiz = async (userId, quizId, transaction) => {
  const attempts = await db.QuizAttempt.findAll({ where: { userId, quizId, gradingStatus: "graded" }, order: [["submittedAt", "ASC"]], transaction });
  if (!attempts.length) return null;
  const method = attempts[0].quizSettingsSnapshot?.gradingMethod || "highest";
  if (method === "average") return { percentage: Math.round((attempts.reduce((sum, row) => sum + Number(row.percentage), 0) / attempts.length) * 100) / 100, passed: attempts.every((row) => row.passed), attemptId: null, gradingMethod: method };
  const selected = method === "latest" ? attempts.at(-1) : method === "first" ? attempts[0] : attempts.reduce((best, row) => Number(row.percentage) > Number(best.percentage) ? row : best);
  return { percentage: Number(selected.percentage), passed: selected.passed === true, attemptId: selected.id, gradingMethod: method };
};

const completionMap = async (userId, activityIds, transaction) => new Map((await db.ActivityCompletion.findAll({ where: { userId, activityId: { [Op.in]: activityIds } }, transaction })).map((row) => [row.activityId, row]));

const previousActivity = (activity, activities) => activities.filter((row) => row.lessonId === activity.lessonId && row.topicId === activity.topicId && row.sortOrder < activity.sortOrder).at(-1) || null;
const previousTopic = (activity, topics) => topics.filter((row) => row.lessonId === activity.lessonId && row.sortOrder < (topics.find((topic) => topic.id === activity.topicId)?.sortOrder ?? -Infinity)).at(-1) || null;

export const accessState = async (userId, activityId, transaction) => {
  const { activity, track } = await trackForActivity(activityId, transaction);
  const { lessons, topics, activities } = await courseActivities(track.id, transaction);
  const ids = activities.map((row) => row.id);
  const [completions, entitled, rules, approvals] = await Promise.all([
    completionMap(userId, ids, transaction), entitlementLessons(userId, lessons.map((row) => row.id), transaction),
    db.ActivityPrerequisite.findAll({ where: { activityId }, order: [["sortOrder", "ASC"]], transaction }),
    db.TeacherActivityApproval.findAll({ where: { userId, activityId, revokedAt: null }, transaction }),
  ]);
  const unmetRequirements = [];
  if (premiumLocked(activity, entitled)) unmetRequirements.push({ type: "premium", message: "Exam Success Pack access is required." });
  for (const rule of rules) {
    let met = true; let message = null; let target = null;
    if (rule.prerequisiteType === "available_after_date") { met = Boolean(rule.availableAfter && new Date(rule.availableAfter) <= now()); message = `Available from ${new Date(rule.availableAfter).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`; }
    else if (rule.prerequisiteType === "teacher_approval") { met = approvals.length > 0; message = "Teacher approval is required."; }
    else if (rule.prerequisiteType === "require_premium_entitlement") { met = !premiumLocked(activity, entitled); message = "Exam Success Pack access is required."; }
    else if (["complete_previous_activity", "complete_specific_activity"].includes(rule.prerequisiteType)) { target = rule.requiredActivityId ? activities.find((row) => row.id === rule.requiredActivityId) : previousActivity(activity, activities); met = Boolean(target && completions.get(target.id)?.status === "completed"); message = target ? `Complete “${title(target)}” first.` : "Complete the required previous activity first."; }
    else if (["pass_previous_quiz", "pass_specific_quiz"].includes(rule.prerequisiteType)) { const previous = rule.requiredQuizId ? await db.Quiz.findByPk(rule.requiredQuizId, { transaction }) : await db.Quiz.findOne({ where: { lessonSectionId: previousActivity(activity, activities)?.id }, transaction }); const grade = previous && await gradeForQuiz(userId, previous.id, transaction); met = Boolean(grade?.passed); target = previous?.Activity; message = previous ? `Pass “${previous.title}” first.` : "Pass the required previous Quiz first."; }
    else if (["complete_previous_topic", "complete_specific_topic"].includes(rule.prerequisiteType)) { const topic = rule.requiredTopicId ? topics.find((row) => row.id === rule.requiredTopicId) : previousTopic(activity, topics); const items = activities.filter((row) => row.topicId === topic?.id && row.completionMode !== "none" && !premiumLocked(row, entitled)); met = Boolean(topic && items.every((row) => completions.get(row.id)?.status === "completed")); message = "Complete the previous Topic first."; }
    if (!met) unmetRequirements.push({ type: rule.prerequisiteType, message, activityId: target?.id || null, availableAfter: rule.availableAfter || null });
  }
  const available = unmetRequirements.length === 0;
  return { available, locked: !available, reasons: unmetRequirements.map((item) => item.message), unmetRequirements, nextAvailableAt: rules.filter((rule) => rule.prerequisiteType === "available_after_date").map((rule) => rule.availableAfter).find((value) => value && new Date(value) > now()) || null, combination: PREREQUISITE_COMBINATION };
};

export const recordCompletion = async (userId, activityId, source, sourceReferenceId = null, transaction) => {
  const { activity, lesson, track } = await trackForActivity(activityId, transaction);
  if (activity.completionMode === "none") return null;
  const [completion] = await db.ActivityCompletion.findOrCreate({ where: { userId, activityId }, defaults: { userId, activityId, courseTrackId: track.id, lessonId: lesson.id, topicId: activity.topicId, completionMode: activity.completionMode, status: "completed", completedAt: now(), source, sourceReferenceId }, transaction });
  if (completion.status !== "completed") await completion.update({ completionMode: activity.completionMode, status: "completed", completedAt: completion.completedAt || now(), source, sourceReferenceId }, { transaction });
  const [legacy] = await db.ContentProgress.findOrCreate({ where: { userId, lessonSectionId: activityId }, defaults: { status: "completed", completedAt: completion.completedAt }, transaction });
  if (legacy.status !== "completed") await legacy.update({ status: "completed", completedAt: completion.completedAt }, { transaction });
  return completion;
};

export const clearManualCompletion = async (userId, activityId, transaction) => {
  const { activity } = await trackForActivity(activityId, transaction);
  if (activity.completionMode !== "manual") throw new ApiError(422, "This activity does not support manual completion");
  await Promise.all([db.ActivityCompletion.destroy({ where: { userId, activityId }, transaction }), db.ContentProgress.destroy({ where: { userId, lessonSectionId: activityId }, transaction })]);
};

export const progressForCourse = async (userId, trackId, transaction) => {
  const { lessons, topics, activities } = await courseActivities(trackId, transaction);
  const entitled = await entitlementLessons(userId, lessons.map((row) => row.id), transaction);
  const applicable = activities.filter((row) => row.completionMode !== "none" && !premiumLocked(row, entitled));
  const completions = await completionMap(userId, applicable.map((row) => row.id), transaction);
  const summary = (rows) => { const requiredCount = rows.length; const completedCount = rows.filter((row) => completions.get(row.id)?.status === "completed").length; return { completedCount, requiredCount, percentage: percent(completedCount, requiredCount), status: requiredCount && completedCount === requiredCount ? "completed" : completedCount ? "in_progress" : "not_started" }; };
  return { course: summary(applicable), lessons: lessons.map((lesson) => ({ lessonId: lesson.id, ...summary(applicable.filter((row) => row.lessonId === lesson.id)) })), topics: topics.map((topic) => ({ topicId: topic.id, ...summary(applicable.filter((row) => row.topicId === topic.id)) })) };
};

export const gradebookForStudent = async (userId, trackId, { teacher = false, transaction } = {}) => {
  const track = await db.CourseTrack.findByPk(trackId, { include: [db.Course, db.Medium], transaction }); if (!track) throw new ApiError(404, "Medium not found");
  const { activities } = await courseActivities(trackId, transaction); const progress = await progressForCourse(userId, trackId, transaction);
  const quizzes = await db.Quiz.findAll({ where: { courseTrackId: trackId }, transaction }); const quizRows = [];
  for (const quiz of quizzes) { const result = await gradeForQuiz(userId, quiz.id, transaction); const pending = await db.QuizAttempt.count({ where: { userId, quizId: quiz.id, gradingStatus: "pending_manual_grading" }, transaction }); quizRows.push({ quizId: quiz.id, activityId: quiz.lessonSectionId, title: quiz.title, ...result, pendingManualGrading: pending > 0 }); }
  const graded = quizRows.filter((row) => row.percentage !== undefined); const pendingGrades = quizRows.some((row) => row.pendingManualGrading); const overallGrade = graded.length ? Math.round((graded.reduce((sum, row) => sum + row.percentage, 0) / graded.length) * 100) / 100 : null;
  const passPercentage = Number(track.coursePassPercentage || 50); const passFail = pendingGrades ? "pending" : overallGrade === null ? "not_started" : overallGrade >= passPercentage ? "pass" : "fail";
  const comments = await db.TeacherGradeComment.findAll({ where: { userId, courseTrackId: trackId, ...(teacher ? {} : { visibility: "student_visible" }) }, order: [["updatedAt", "DESC"]], transaction });
  return { course: { id: track.id, title: track.Course?.titleEn || track.Course?.title || track.title, medium: track.Medium?.nameEn || track.Medium?.name, passPercentage }, completion: progress.course, activities: activities.length, quizzes: quizRows, assignmentMarks: null, overallGrade, passFail, pendingGrades, comments: comments.map((row) => ({ id: row.id, comment: row.comment, visibility: row.visibility, updatedAt: row.updatedAt })), lastUpdatedAt: new Date() };
};

const assertRuleTarget = async (activity, values, transaction) => {
  if (values.requiredActivityId) { if (values.requiredActivityId === activity.id) throw new ApiError(422, "An activity cannot depend on itself"); const target = await trackForActivity(values.requiredActivityId, transaction); const current = await trackForActivity(activity.id, transaction); if (target.track.id !== current.track.id) throw new ApiError(422, "Prerequisite targets must belong to the same Medium"); }
  if (values.requiredTopicId) { const topic = await db.Topic.findByPk(values.requiredTopicId, { include: [db.Lesson], transaction }); if (!topic || topic.Lesson.trackId !== (await trackForActivity(activity.id, transaction)).track.id) throw new ApiError(422, "Prerequisite Topic must belong to the same Medium"); }
  if (values.requiredQuizId) { const quiz = await db.Quiz.findByPk(values.requiredQuizId, { transaction }); if (!quiz || quiz.courseTrackId !== (await trackForActivity(activity.id, transaction)).track.id) throw new ApiError(422, "Prerequisite Quiz must belong to the same Medium"); }
};
export const savePrerequisite = async (user, activityId, body, id = null) => db.sequelize.transaction(async (transaction) => {
  const { activity, track } = await trackForActivity(activityId, transaction); await assertGradebookScope(user, track.id, "canManageContent");
  const values = { prerequisiteType: body.prerequisiteType, requiredActivityId: body.requiredActivityId || null, requiredTopicId: body.requiredTopicId || null, requiredQuizId: body.requiredQuizId || null, requiredEntitlementType: body.requiredEntitlementType || null, availableAfter: body.availableAfter || null, teacherApprovalRequired: body.prerequisiteType === "teacher_approval", sortOrder: Number(body.sortOrder) || 0, updatedByUserId: user.sub };
  if (!values.prerequisiteType || !["complete_previous_activity", "pass_previous_quiz", "complete_previous_topic", "require_premium_entitlement", "available_after_date", "teacher_approval", "complete_specific_activity", "pass_specific_quiz", "complete_specific_topic"].includes(values.prerequisiteType)) throw new ApiError(422, "Invalid prerequisite type");
  if (values.prerequisiteType === "available_after_date" && !values.availableAfter) throw new ApiError(422, "An available-after date is required"); await assertRuleTarget(activity, values, transaction);
  if (id) { const rule = await db.ActivityPrerequisite.findOne({ where: { id, activityId }, transaction }); if (!rule) throw new ApiError(404, "Prerequisite not found"); await rule.update(values, { transaction }); return rule; }
  return db.ActivityPrerequisite.create({ ...values, activityId, createdByUserId: user.sub }, { transaction });
});
