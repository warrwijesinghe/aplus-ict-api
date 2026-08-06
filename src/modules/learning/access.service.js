import { isPremium } from "../content/activity-registry.js";
import { hasPremiumAccess } from "../commerce/commerce.service.js";

/**
 * An entitlement unlocks the premium part of one lesson. Free sections
 * never require a purchase, even when they sit inside a premium lesson.
 */
export const canAccessLesson = async (userId, lesson) => {
  return hasPremiumAccess(userId, { lessonId: lesson.id, courseTrackId: lesson.trackId });
};

export const canAccessContent = async (
  userId,
  lesson,
  section,
  lessonUnlocked,
) => {
  if (!isPremium(section.accessPolicy)) return true;

  // The course progress endpoint already knows the lesson entitlement. Passing
  // it in avoids repeating the same database query for every content item.
  return lessonUnlocked ?? canAccessLesson(userId, lesson);
};
