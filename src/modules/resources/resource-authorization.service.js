import { db } from "../../models/index.js";
import { privilegedRoles } from "../../security/authorization.js";
import { canAccessContent } from "../learning/access.service.js";

const active = (resource) => ["active", "ready"].includes(resource.status) && !resource.deletedAt;
const isAdmin = (user) => privilegedRoles.has(user?.role);

export const canManageResource = (user, resource) => Boolean(user && (isAdmin(user) || resource.uploadedByUserId === user.sub || resource.ownerUserId === user.sub));
export const canReplaceResource = canManageResource;
export const canArchiveResource = canManageResource;

export const canViewResource = async (user, resource) => {
  if (!active(resource)) return false;
  if (resource.visibility === "public" && resource.accessPolicy === "public") return true;
  if (!user) return false;
  if (resource.category === "payment_slip") return resource.uploadedByUserId === user.sub || resource.ownerUserId === user.sub || (isAdmin(user) && user.permissions?.includes("payments.read"));
  if (isAdmin(user)) return true;
  if (resource.accessPolicy === "authenticated") return true;
  if (resource.accessPolicy === "owner_only") return resource.uploadedByUserId === user.sub || resource.ownerUserId === user.sub;
  const activities = await db.LessonSection.findAll({ where: { resourceId: resource.id }, include: [db.Lesson] });
  if (!activities.length) return canManageResource(user, resource);
  for (const activity of activities) if (await canAccessContent(user.sub, activity.Lesson, activity)) return true;
  if (resource.accessPolicy === "course_enrolled") {
    const lessonIds = activities.map((activity) => activity.lessonId).filter(Boolean);
    const lesson = lessonIds.length && await db.Lesson.findByPk(lessonIds[0]);
    const trackId = lesson?.trackId;
    return Boolean(trackId && await db.Enrolment.findOne({ where: { userId: user.sub, courseTrackId: trackId, status: "active" } }));
  }
  return false;
};
export const canDownloadResource = canViewResource;
export const userCanReadSensitivePayment = async (user, resource) => {
  if (!user || resource.category !== "payment_slip") return false;
  if (isAdmin(user) && user.permissions?.includes("payments.read")) return true;
  return resource.uploadedByUserId === user.sub || resource.ownerUserId === user.sub;
};
