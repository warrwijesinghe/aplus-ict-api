import { Op } from "sequelize";
import { db } from "../../models/index.js";
import { isPremium } from "../content/activity-registry.js";

/**
 * An entitlement unlocks the premium part of one lesson. Free sections
 * never require a purchase, even when they sit inside a premium lesson.
 */
export const canAccessLesson = async (userId, lesson) => {
  const entitlement = await db.Entitlement.findOne({
    where: {
      userId,
      lessonId: lesson.id,
      status: "active",
      [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: new Date() } }],
    },
  });
  return Boolean(entitlement);
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
