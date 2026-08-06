import { isPremium } from "../activity-registry.js";
import { sanitizeEducationalHtml } from "./html-sanitizer.js";

const base = (activity) => ({
  id: activity.id, type: activity.type, contentType: activity.type,
  title: activity.title || activity.titleEn, titleEn: activity.titleEn || activity.title, titleSi: activity.titleSi || null,
  descriptionEn: activity.descriptionEn || null, descriptionSi: activity.descriptionSi || null,
  accessPolicy: isPremium(activity.accessPolicy) ? "premium" : "free",
  completionMode: activity.completionMode || "none", estimatedMinutes: activity.estimatedMinutes || null,
  sortOrder: activity.sortOrder, isLocked: false,
});

export const serializeActivity = (activity, audience = "authorized_student") => {
  const locked = ["public", "unauthorized_student"].includes(audience) && isPremium(activity.accessPolicy);
  const shared = { ...base(activity), isLocked: locked };
  if (locked) return shared;
  const editable = {
    ...shared, lessonId: activity.lessonId, topicId: activity.topicId, title: activity.title, content: sanitizeEducationalHtml(activity.content),
    youtubeUrl: activity.youtubeUrl, externalUrl: activity.externalUrl, resourceId: activity.resourceId, config: activity.config,
    instructions: sanitizeEducationalHtml(activity.instructions), maxScore: activity.maxScore, passingScore: activity.passingScore,
    configVersion: activity.configVersion || 1, status: activity.status, isVisible: activity.isVisible,
    availableFrom: activity.availableFrom, availableUntil: activity.availableUntil, publishedAt: activity.publishedAt,
  };
  return audience === "admin" ? editable : Object.fromEntries(Object.entries(editable).filter(([key]) => !["status", "isVisible", "availableFrom", "availableUntil", "publishedAt", "configVersion", "lessonId", "topicId"].includes(key)));
};
