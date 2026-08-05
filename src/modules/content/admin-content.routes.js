import { Router } from "express";
import { Op } from "sequelize";
import { db } from "../../models/index.js";
import { ApiError, asyncHandler } from "../../core/errors.js";
import { authenticate } from "../auth/auth.js";
import { audit, hasCourseAssignment, privilegedRoles, requirePermission } from "../../security/authorization.js";
import { PERMISSIONS } from "../../security/permissions.js";
import { assertActivityRelations, assertParent, reorder } from "./content.service.js";
import { pick, validateContentPayload } from "./content-validation.js";

const send = (res, data, status = 200) => res.status(status).json({ data });
const privileged = (req) => privilegedRoles.has(req.user.role);
const actionFor = (req, status) => status === "archived" ? "content_archived" : status === "published" ? "content_published" : null;
const trackForLesson = async (lessonId) => (await assertParent(db.Lesson, lessonId, "Lesson not found")).trackId;
const trackForTopic = async (topicId) => trackForLesson((await assertParent(db.Topic, topicId, "Topic not found")).lessonId);
const trackForActivity = async (activityId) => trackForLesson((await assertParent(db.LessonSection, activityId, "Activity not found")).lessonId);
const requireTrack = (permission, capability, findTrack) => [authenticate, requirePermission(permission), asyncHandler(async (req, _res, next) => {
  if (privileged(req)) return next();
  const trackId = await findTrack(req);
  const track = await assertParent(db.CourseTrack, trackId, "Course track not found");
  if (!(await hasCourseAssignment(req.user.sub, { trackId, courseId: track.courseId, capability }))) throw new ApiError(403, "You are not assigned to this course track");
  next();
})];
const requireCourse = (permission, findCourseId) => [authenticate, requirePermission(permission), asyncHandler(async (req, _res, next) => {
  if (privileged(req)) return next();
  const courseId = await findCourseId(req);
  if (!(await hasCourseAssignment(req.user.sub, { courseId, capability: "canManageContent" }))) throw new ApiError(403, "You are not assigned to this course");
  next();
})];
const manageableTrackIds = async (req) => {
  if (privileged(req)) return null;
  const assignments = await db.EducatorAssignment.findAll({ where: { userId: req.user.sub, status: "active", canManageContent: true }, attributes: ["courseId", "courseTrackId"] });
  const direct = assignments.map((item) => item.courseTrackId).filter(Boolean);
  const courses = assignments.map((item) => item.courseId).filter(Boolean);
  const tracks = courses.length ? await db.CourseTrack.findAll({ where: { courseId: { [Op.in]: courses } }, attributes: ["id"] }) : [];
  return [...new Set([...direct, ...tracks.map((item) => item.id)])];
};
const scopedList = async (req, Model, kind) => {
  const trackIds = await manageableTrackIds(req);
  const options = { order: [["sortOrder", "ASC"]] };
  if (trackIds === null) return Model.findAll(options);
  if (kind === "lesson") options.where = { trackId: { [Op.in]: trackIds } };
  if (kind === "topic") options.include = [{ model: db.Lesson, where: { trackId: { [Op.in]: trackIds } }, required: true }];
  if (kind === "activity") options.include = [{ model: db.Lesson, where: { trackId: { [Op.in]: trackIds } }, required: true }];
  return Model.findAll(options);
};

const fields = {
  course: ["categoryId", "academicLevelId", "title", "titleEn", "titleSi", "slug", "code", "courseGroup", "academicLevel", "description", "shortDescriptionEn", "shortDescriptionSi", "status", "sortOrder", "isFeatured", "isPublic", "publishedAt"],
  track: ["courseId", "mediumId", "title", "slug", "status", "availabilityStatus", "isPublic", "enrolmentOpen", "sortOrder", "publishedAt"],
  lesson: ["trackId", "title", "titleEn", "titleSi", "slug", "lessonNumber", "estimatedPeriods", "estimatedMinutes", "summary", "descriptionEn", "descriptionSi", "status", "isVisible", "availableFrom", "availableUntil", "sortOrder", "publishedAt"],
  topic: ["lessonId", "slug", "title", "titleEn", "titleSi", "descriptionEn", "descriptionSi", "status", "isVisible", "availableFrom", "availableUntil", "sortOrder"],
  activity: ["lessonId", "topicId", "type", "title", "titleEn", "titleSi", "descriptionEn", "descriptionSi", "instructions", "accessPolicy", "completionMode", "estimatedMinutes", "content", "youtubeUrl", "externalUrl", "resourceId", "config", "maxScore", "passingScore", "status", "isVisible", "availableFrom", "availableUntil", "sortOrder"],
};

export const createContentAdminRouter = () => {
  const router = Router();
  const simple = (path, Model, kind, permission, event) => {
    router.get(`/admin/${path}`, authenticate, requirePermission(permission.read), asyncHandler(async (_req, res) => send(res, await Model.findAll({ order: [["sortOrder", "ASC"]] }))));
    router.post(`/admin/${path}`, authenticate, requirePermission(permission.create), asyncHandler(async (req, res) => { validateContentPayload(req.body, kind); const row = await Model.create(pick(req.body, fields[kind])); await audit(req, `${event}_created`, kind, row.id, { status: row.status }); send(res, row, 201); }));
    router.get(`/admin/${path}/:id`, authenticate, requirePermission(permission.read), asyncHandler(async (req, res) => { const row = await Model.findByPk(req.params.id); if (!row) throw new ApiError(404, "Not found"); send(res, row); }));
    router.patch(`/admin/${path}/:id`, authenticate, requirePermission(permission.update), asyncHandler(async (req, res) => { const row = await Model.findByPk(req.params.id); if (!row) throw new ApiError(404, "Not found"); validateContentPayload(req.body, kind); const values = pick(req.body, fields[kind]); await row.update(values); await audit(req, actionFor(req, values.status) || `${event}_updated`, kind, row.id, { fields: Object.keys(values), status: row.status }); send(res, row); }));
  };
  simple("academic-levels", db.AcademicLevel, "level", { read: PERMISSIONS.COURSES_READ, create: PERMISSIONS.COURSES_CREATE, update: PERMISSIONS.COURSES_UPDATE }, "academic_level");
  simple("courses", db.Course, "course", { read: PERMISSIONS.COURSES_READ, create: PERMISSIONS.COURSES_CREATE, update: PERMISSIONS.COURSES_UPDATE }, "course");

  router.get("/admin/tracks", authenticate, requirePermission(PERMISSIONS.TRACKS_READ), asyncHandler(async (req, res) => { const trackIds = await manageableTrackIds(req); send(res, await db.CourseTrack.findAll({ ...(trackIds === null ? {} : { where: { id: { [Op.in]: trackIds } } }), include: [db.Course, db.Medium], order: [["sortOrder", "ASC"]] })); }));
  router.post("/admin/tracks", ...requireCourse(PERMISSIONS.TRACKS_CREATE, (req) => req.body.courseId), asyncHandler(async (req, res) => { validateContentPayload(req.body, "track"); await assertParent(db.Course, req.body.courseId, "Course does not exist"); await assertParent(db.Medium, req.body.mediumId, "Medium does not exist"); const row = await db.CourseTrack.create(pick(req.body, fields.track)); await audit(req, "track_created", "track", row.id, { courseId: row.courseId, mediumId: row.mediumId }); send(res, row, 201); }));
  router.get("/admin/tracks/:id", ...requireTrack(PERMISSIONS.TRACKS_READ, "canManageContent", (req) => req.params.id), asyncHandler(async (req, res) => send(res, await assertParent(db.CourseTrack, req.params.id, "Course track not found"))));
  router.patch("/admin/tracks/:id", ...requireTrack(PERMISSIONS.TRACKS_UPDATE, "canManageContent", (req) => req.params.id), asyncHandler(async (req, res) => { const row = await assertParent(db.CourseTrack, req.params.id, "Course track not found"); validateContentPayload(req.body, "track"); const values = pick(req.body, fields.track); if (values.courseId && values.courseId !== row.courseId) throw new ApiError(422, "A CourseTrack cannot be moved to another Course"); await row.update(values); await audit(req, actionFor(req, values.status) || "track_updated", "track", row.id, { fields: Object.keys(values) }); send(res, row); }));

  const scoped = (path, Model, kind, permission, event, resolveTrack, validateRelations = async () => {}) => {
    router.get(`/admin/${path}`, authenticate, requirePermission(permission.read), asyncHandler(async (req, res) => send(res, await scopedList(req, Model, kind))));
    router.post(`/admin/${path}`, ...requireTrack(permission.create, "canManageContent", resolveTrack), asyncHandler(async (req, res) => { validateContentPayload(req.body, kind); await validateRelations(req.body); const row = await Model.create(pick(req.body, fields[kind])); await audit(req, `${event}_created`, kind, row.id, { parentId: row.trackId || row.lessonId || row.topicId }); send(res, row, 201); }));
    router.get(`/admin/${path}/:id`, ...requireTrack(permission.read, "canManageContent", (req) => resolveTrack({ ...req, body: { ...req.body, id: req.params.id } })), asyncHandler(async (req, res) => send(res, await assertParent(Model, req.params.id, "Not found"))));
    router.patch(`/admin/${path}/:id`, ...requireTrack(permission.update, "canManageContent", (req) => resolveTrack({ ...req, body: { ...req.body, id: req.params.id } })), asyncHandler(async (req, res) => { const row = await assertParent(Model, req.params.id, "Not found"); validateContentPayload(req.body, kind); const values = pick(req.body, fields[kind]); const parentField = { lesson: "trackId", topic: "lessonId", activity: "lessonId" }[kind]; if (values[parentField] && values[parentField] !== row[parentField]) throw new ApiError(422, "Moving content between parents is not supported"); await validateRelations(values, row); await row.update(values); await audit(req, actionFor(req, values.status) || `${event}_updated`, kind, row.id, { fields: Object.keys(values) }); send(res, row); }));
  };
  scoped("lessons", db.Lesson, "lesson", { read: PERMISSIONS.LESSONS_READ, create: PERMISSIONS.LESSONS_CREATE, update: PERMISSIONS.LESSONS_UPDATE }, "lesson", async (req) => req.body.trackId || trackForLesson(req.body.id));
  scoped("topics", db.Topic, "topic", { read: PERMISSIONS.TOPICS_READ, create: PERMISSIONS.TOPICS_CREATE, update: PERMISSIONS.TOPICS_UPDATE }, "topic", async (req) => trackForLesson(req.body.lessonId || (await assertParent(db.Topic, req.body.id, "Topic not found")).lessonId), async (values) => assertParent(db.Lesson, values.lessonId, "Lesson does not exist"));
  scoped("activities", db.LessonSection, "activity", { read: PERMISSIONS.ACTIVITIES_READ, create: PERMISSIONS.ACTIVITIES_CREATE, update: PERMISSIONS.ACTIVITIES_UPDATE }, "activity", async (req) => req.body.lessonId ? trackForLesson(req.body.lessonId) : trackForActivity(req.body.id), assertActivityRelations);
  // Legacy Admin clients still use /sections; it now applies the same Learning
  // Activity validation, permissions, and parent checks as /activities.
  scoped("sections", db.LessonSection, "activity", { read: PERMISSIONS.ACTIVITIES_READ, create: PERMISSIONS.ACTIVITIES_CREATE, update: PERMISSIONS.ACTIVITIES_UPDATE }, "activity", async (req) => req.body.lessonId ? trackForLesson(req.body.lessonId) : trackForActivity(req.body.id), assertActivityRelations);
  const reorderRoute = (path, permission, parentModel, parentParam, Model, parentField, resolveTrack) => router.patch(path, ...requireTrack(permission, "canManageContent", resolveTrack), asyncHandler(async (req, res) => { await assertParent(parentModel, req.params[parentParam], "Parent not found"); await reorder({ Model, parentField, parentId: req.params[parentParam], orderedIds: req.body.orderedIds }); await audit(req, "content_reordered", "content", req.params[parentParam], { parentField, count: req.body.orderedIds.length }); send(res, { orderedIds: req.body.orderedIds }); }));
  reorderRoute("/admin/tracks/:trackId/lessons/reorder", PERMISSIONS.LESSONS_REORDER, db.CourseTrack, "trackId", db.Lesson, "trackId", (req) => req.params.trackId);
  reorderRoute("/admin/lessons/:lessonId/topics/reorder", PERMISSIONS.TOPICS_REORDER, db.Lesson, "lessonId", db.Topic, "lessonId", (req) => trackForLesson(req.params.lessonId));
  reorderRoute("/admin/topics/:topicId/activities/reorder", PERMISSIONS.ACTIVITIES_REORDER, db.Topic, "topicId", db.LessonSection, "topicId", (req) => trackForTopic(req.params.topicId));
  return router;
};
