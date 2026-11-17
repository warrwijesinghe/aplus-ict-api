import { Op } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { serializeActivity } from "./activities/activity-serializer.js";

const numberedTopic = (topic) => (topic.title || topic.titleEn || "").match(/^(\d+(?:\.\d+)*)(?:[.)])?\s+\S/)?.[1];

const assertDeletable = (row, label) => {
  if (!row) throw new ApiError(404, `${label} not found.`);
  if (row.status === "published") throw new ApiError(409, `Unpublish or archive this ${label.toLowerCase()} before deleting it.`);
};

const assertNoLinkedRecords = async (references, transaction, message) => {
  for (const [Model, where] of references) {
    if (await Model.findOne({ where, attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE })) {
      throw new ApiError(409, message);
    }
  }
};

export const deleteTopic = (id) => db.sequelize.transaction(async (transaction) => {
  const existing = await db.Topic.findByPk(id, { attributes: ["lessonId"], transaction });
  if (!existing) throw new ApiError(404, "Topic not found.");
  const lessonTopics = await db.Topic.findAll({
    where: { lessonId: existing.lessonId },
    attributes: ["id", "title", "titleEn", "status"], order: [["id", "ASC"]],
    transaction, lock: transaction.LOCK.UPDATE,
  });
  const topic = lessonTopics.find((entry) => entry.id === id);
  assertDeletable(topic, "Topic");

  const branch = [topic];
  const numbered = new Map();
  const entries = lessonTopics.flatMap((entry) => {
    const number = numberedTopic(entry);
    if (!number) return [];
    numbered.set(number, numbered.has(number) ? null : entry);
    return [{ entry, parts: number.split(".") }];
  });
  const branchIds = new Set([id]);
  for (const { entry, parts } of entries.sort((a, b) => a.parts.length - b.parts.length)) {
    let parent;
    while (parts.length > 1 && !parent) {
      parts.pop();
      parent = numbered.get(parts.join("."));
    }
    if (parent && branchIds.has(parent.id)) {
      branch.push(entry);
      branchIds.add(entry.id);
    }
  }

  if (branch.some((entry) => entry.status === "published")) {
    throw new ApiError(409, "Unpublish or archive the published subtopics before deleting this topic.");
  }
  const ids = { [Op.in]: [...branchIds] };
  await assertNoLinkedRecords([
    [db.LessonSection, { topicId: ids }],
  ], transaction, "Remove the linked activities from this topic and its subtopics before deleting them.");
  await assertNoLinkedRecords([
    [db.Quiz, { topicId: ids }],
    [db.Question, { topicId: ids }],
    [db.ActivityPrerequisite, { requiredTopicId: ids }],
    [db.ActivityCompletion, { topicId: ids }],
    [db.StudentCourseState, { lastTopicId: ids }],
    [db.StudentLearningHistory, { topicId: ids }],
  ], transaction, "This topic or a subtopic has linked records and cannot be permanently deleted.");
  return db.Topic.destroy({ where: { id: ids }, transaction });
});

export const deleteActivity = (id) => db.sequelize.transaction(async (transaction) => {
  const activity = await db.LessonSection.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  assertDeletable(activity, "Activity");
  await assertNoLinkedRecords([
    [db.ActivityCompletion, { activityId: id }],
    [db.ContentProgress, { lessonSectionId: id }],
    [db.TeacherActivityApproval, { activityId: id }],
    [db.ActivityPrerequisite, { requiredActivityId: id }],
    [db.Entitlement, { activityId: id }],
    [db.ProductEntitlementRule, { activityId: id }],
    [db.StudentCourseState, { lastActivityId: id }],
    [db.StudentLearningHistory, { activityId: id }],
  ], transaction, "This activity has learner records or linked content and cannot be permanently deleted.");

  const quiz = await db.Quiz.findOne({ where: { lessonSectionId: id }, transaction, lock: transaction.LOCK.UPDATE });
  if (quiz) {
    assertDeletable(quiz, "Quiz");
    await assertNoLinkedRecords([
      [db.QuizAttempt, { quizId: quiz.id }],
      [db.QuizGrade, { quizId: quiz.id }],
      [db.ActivityPrerequisite, { requiredQuizId: quiz.id }],
      [db.StudentLearningHistory, { quizId: quiz.id }],
    ], transaction, "This quiz has attempts, grades or linked content and cannot be permanently deleted.");
    await quiz.destroy({ transaction });
  }
  await db.ActivityPrerequisite.destroy({ where: { activityId: id }, transaction });
  await activity.destroy({ transaction });
});

const now = () => new Date();
export const publishedWhere = () => ({ status: "published", isVisible: { [Op.ne]: false }, [Op.and]: [{ [Op.or]: [{ availableFrom: null }, { availableFrom: { [Op.lte]: now() } }] }, { [Op.or]: [{ availableUntil: null }, { availableUntil: { [Op.gte]: now() } }] }] });
export const isPubliclyAvailable = (record) => record.status === "published" && record.isVisible !== false && (!record.availableFrom || new Date(record.availableFrom) <= now()) && (!record.availableUntil || new Date(record.availableUntil) >= now());

export const safeActivity = (activity, entitled = false) => serializeActivity(activity, entitled ? "authorized_student" : "public");

export const assertParent = async (Model, id, message) => {
  const row = await Model.findByPk(id);
  if (!row) throw new ApiError(422, message);
  return row;
};

export const assertActivityRelations = async (values, current = null) => {
  const lessonId = values.lessonId ?? current?.lessonId;
  const topicId = values.topicId ?? current?.topicId;
  if (topicId) {
    const topic = await assertParent(db.Topic, topicId, "Topic does not exist");
    if (lessonId && topic.lessonId !== lessonId) throw new ApiError(422, "Activity Topic must belong to the specified Lesson");
  }
  if (values.resourceId) await assertParent(db.Resource, values.resourceId, "Resource does not exist");
};

export const reorder = async ({ Model, parentField, parentId, orderedIds }) => {
  if (!Array.isArray(orderedIds) || !orderedIds.length || new Set(orderedIds).size !== orderedIds.length) throw new ApiError(422, "orderedIds must be a non-empty list of unique IDs");
  await db.sequelize.transaction(async (transaction) => {
    const rows = await Model.findAll({ where: { [parentField]: parentId }, attributes: ["id"], transaction, lock: transaction.LOCK.UPDATE });
    if (rows.length !== orderedIds.length || rows.some((row) => !orderedIds.includes(row.id))) throw new ApiError(422, "Every ordered ID must belong to the specified parent");
    await Promise.all(orderedIds.map((id, index) => Model.update({ sortOrder: index + 1 }, { where: { id }, transaction })));
  });
};

export const duplicateLessonDraft = async (lessonId, targetTrackId = null) => db.sequelize.transaction(async (transaction) => {
  const source = await db.Lesson.findByPk(lessonId, { include: [{ model: db.Topic, include: [db.LessonSection] }, db.LessonSection], transaction });
  if (!source) throw new ApiError(404, "Lesson not found");
  const lesson = await db.Lesson.create({ ...source.get({ plain: true }), id: undefined, trackId: targetTrackId || source.trackId, slug: `${source.slug}-copy-${Date.now()}`, status: "draft", isVisible: false, publishedAt: null }, { transaction });
  for (const topic of source.Topics || []) {
    const copy = await db.Topic.create({ ...topic.get({ plain: true }), id: undefined, lessonId: lesson.id, slug: topic.slug ? `${topic.slug}-copy-${Date.now()}` : null, status: "draft", isVisible: false }, { transaction });
    for (const activity of topic.LessonSections || []) await db.LessonSection.create({ ...activity.get({ plain: true }), id: undefined, lessonId: lesson.id, topicId: copy.id, status: "draft", isVisible: false }, { transaction });
  }
  return lesson;
});

export const duplicateTopicDraft = async (topicId, includeActivities = true) => db.sequelize.transaction(async (transaction) => {
  const source = await db.Topic.findByPk(topicId, { include: [db.LessonSection], transaction });
  if (!source) throw new ApiError(404, "Topic not found");
  const nextSortOrder = (await db.Topic.max("sortOrder", { where: { lessonId: source.lessonId }, transaction }) || 0) + 1;
  const topic = await db.Topic.create({ ...source.get({ plain: true }), id: undefined, title: `${source.title || source.titleEn || "Topic"} (copy)`, slug: source.slug ? `${source.slug}-copy-${Date.now()}` : null, status: "draft", isVisible: false, sortOrder: nextSortOrder }, { transaction });
  if (includeActivities) for (const activity of source.LessonSections || []) await db.LessonSection.create({ ...activity.get({ plain: true }), id: undefined, lessonId: topic.lessonId, topicId: topic.id, title: `${activity.title || activity.titleEn || "Activity"} (copy)`, status: "draft", isVisible: false, publishedAt: null }, { transaction });
  return topic;
});
