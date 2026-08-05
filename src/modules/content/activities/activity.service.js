import { ApiError } from "../../../core/errors.js";
import { db } from "../../../models/index.js";
import { assertActivityRelations } from "../content.service.js";
import { validateActivityDraft, validateActivityForPublishing, validateActivityResource } from "./activity-validator.js";
import { getActivityType } from "./activity-types.js";

const writableFields = ["lessonId", "topicId", "type", "title", "titleEn", "titleSi", "descriptionEn", "descriptionSi", "instructions", "accessPolicy", "completionMode", "estimatedMinutes", "content", "youtubeUrl", "externalUrl", "resourceId", "config", "configVersion", "maxScore", "passingScore", "status", "isVisible", "availableFrom", "availableUntil", "sortOrder"];
const pick = (values) => Object.fromEntries(writableFields.filter((field) => Object.hasOwn(values, field)).map((field) => [field, values[field]]));

const validateRelations = async (values, current = null) => {
  await assertActivityRelations(values, current);
  const resourceId = values.resourceId ?? current?.resourceId;
  if (resourceId) {
    const resource = await db.Resource.findByPk(resourceId);
    if (!resource) throw new ApiError(422, "Resource does not exist");
    await validateActivityResource({ ...current?.get?.({ plain: true }), ...values }, resource);
  }
};

const withDefaults = (values) => {
  const type = getActivityType(values.type);
  return {
    accessPolicy: "free", completionMode: type.supportedCompletionModes[0], status: "draft", isVisible: true,
    configVersion: 1, config: Object.keys(type.defaultConfig).length ? { ...type.defaultConfig } : undefined, ...values,
  };
};

export const createActivity = async (payload) => {
  if (payload.status === "published") throw new ApiError(422, "Use the publish endpoint after saving the draft");
  const values = validateActivityDraft(withDefaults(payload));
  if (!values.lessonId || !values.topicId) throw new ApiError(422, "Learning Activity requires lessonId and topicId");
  await validateRelations(values);
  if (!Object.hasOwn(values, "config")) values.config = undefined;
  return db.LessonSection.create(pick(values));
};

export const updateActivity = async (activityId, payload) => {
  const activity = await db.LessonSection.findByPk(activityId);
  if (!activity) throw new ApiError(404, "Activity not found");
  if (Object.hasOwn(payload, "status")) throw new ApiError(422, "Use a lifecycle endpoint to change activity status");
  const values = validateActivityDraft(payload, activity.get({ plain: true }));
  if (values.lessonId && values.lessonId !== activity.lessonId) throw new ApiError(422, "Moving an activity between lessons is not supported");
  if (values.topicId && values.topicId !== activity.topicId) throw new ApiError(422, "Moving an activity between topics is not supported; use duplicate instead");
  await validateRelations(values, activity);
  if (!Object.keys(values).length) throw new ApiError(422, "No activity fields were supplied");
  await activity.update(pick(values));
  return activity;
};

export const validateDraft = (activity) => validateActivityDraft(activity, activity);
export const validateForPublishing = async (activity) => {
  validateActivityForPublishing(activity);
  await validateRelations(activity, activity);
  return activity;
};
export const publishActivity = async (activityId) => {
  const activity = await db.LessonSection.findByPk(activityId);
  if (!activity) throw new ApiError(404, "Activity not found");
  await validateForPublishing(activity.get({ plain: true }));
  await activity.update({ status: "published", publishedAt: new Date() });
  return activity;
};
export const unpublishActivity = async (activityId) => {
  const activity = await db.LessonSection.findByPk(activityId);
  if (!activity) throw new ApiError(404, "Activity not found");
  await activity.update({ status: "draft", publishedAt: null });
  return activity;
};
export const archiveActivity = async (activityId) => {
  const activity = await db.LessonSection.findByPk(activityId);
  if (!activity) throw new ApiError(404, "Activity not found");
  await activity.update({ status: "archived", isVisible: false });
  return activity;
};
export const duplicateActivity = async (activityId, destinationTopicId = null) => db.sequelize.transaction(async (transaction) => {
  const source = await db.LessonSection.findByPk(activityId, { transaction });
  if (!source) throw new ApiError(404, "Activity not found");
  const destination = destinationTopicId ? await db.Topic.findByPk(destinationTopicId, { transaction }) : await db.Topic.findByPk(source.topicId, { transaction });
  if (!destination) throw new ApiError(422, "Destination Topic does not exist");
  const nextSortOrder = (await db.LessonSection.max("sortOrder", { where: { topicId: destination.id }, transaction }) || 0) + 1;
  return db.LessonSection.create({ ...source.get({ plain: true }), id: undefined, lessonId: destination.lessonId, topicId: destination.id, title: `${source.title || source.titleEn || "Activity"} (copy)`, status: "draft", isVisible: false, publishedAt: null, sortOrder: nextSortOrder }, { transaction });
});
