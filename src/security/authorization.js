import { Op } from "sequelize";
import { db } from "../models/index.js";
import { ApiError, asyncHandler } from "../core/errors.js";

export const privilegedRoles = new Set(["admin", "super_admin"]);

export const getAuthorization = async (userId) => {
  const user = await db.User.findByPk(userId, {
    include: [{ model: db.Role, where: { isActive: true }, required: false, include: [{ model: db.Permission, required: false }] }],
  });
  if (!user || user.status !== "active") throw new ApiError(401, "Account is unavailable");
  const roles = user.Roles || [];
  const roleCodes = roles.map((role) => role.code);
  const role = roleCodes.includes("super_admin") ? "super_admin" : roleCodes[0] || user.role || "student";
  const permissions = [...new Set(roles.flatMap((role) => (role.Permissions || []).map((permission) => permission.code)))];
  return { user, role, roles: roleCodes.length ? roleCodes : [role], permissions };
};

export const attachAuthorization = asyncHandler(async (req, _res, next) => {
  const current = await getAuthorization(req.user.sub);
  req.user = { ...req.user, sub: current.user.id, role: current.role, roles: current.roles, permissions: current.permissions };
  next();
});

export const requirePermission = (...permissions) => (req, _res, next) =>
  permissions.some((permission) => req.user.permissions?.includes(permission))
    ? next() : next(new ApiError(403, "Insufficient permission"));

export const hasCourseAssignment = async (userId, { courseId, trackId, capability }) => {
  const assignment = await db.EducatorAssignment.findOne({
    where: {
      userId, status: "active",
      ...(trackId ? { [Op.or]: [{ courseTrackId: trackId }, { courseId }] } : { courseId }),
    },
  });
  return Boolean(assignment && (!capability || assignment[capability]));
};

export const requireTrackAssignment = (capability) => asyncHandler(async (req, _res, next) => {
  if (privilegedRoles.has(req.user.role)) return next();
  const trackId = req.params.trackId || req.body.courseTrackId;
  const track = trackId && await db.CourseTrack.findByPk(trackId);
  if (!track || !(await hasCourseAssignment(req.user.sub, { trackId, courseId: track.courseId, capability })))
    throw new ApiError(403, "You are not assigned to this course track");
  next();
});

export const requirePermissionForTrack = (permission, capability) => [requirePermission(permission), requireTrackAssignment(capability)];

export const audit = (req, action, targetType, targetId, metadata = {}) =>
  db.AuditLog.create({ actorUserId: req.user.sub, action, targetType, targetId, metadata, ipAddress: req.ip, userAgent: req.get("user-agent") || null });
