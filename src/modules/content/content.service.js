import { Op } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { serializeActivity } from "./activities/activity-serializer.js";

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
