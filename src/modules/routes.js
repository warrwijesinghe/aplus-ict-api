import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { Op } from "sequelize";
import { db } from "../models/index.js";
import { ApiError, asyncHandler } from "../core/errors.js";
import {
  authenticate,
  optionallyAuthenticate,
  authorize,
  authRoutes,
} from "./auth/auth.js";
import { uploadStorage } from "./resources/storage.js";
import { UPLOAD_CATEGORIES } from "./resources/upload-config.js";
import { validatePaymentSlip, validateUpload } from "./resources/upload-validation.js";
import { normalizePublicImage } from "./resources/image-processing.js";
import { publicCategoryResponse } from "./resources/category-registry.js";
import { archiveResource, createResource, createResourceReplacement, resourceResponse, streamResource } from "./resources/resource.service.js";
import { canArchiveResource, canDownloadResource, canManageResource, canReplaceResource, canViewResource } from "./resources/resource-authorization.service.js";
import { env } from "../config/env.js";
import {
  downloadableResourceInput,
  findPublishedDownload,
  findPublishedDownloads,
} from "./resources/downloadable-resource.service.js";
import {
  canAccessContent,
  canAccessLesson,
} from "./learning/access.service.js";
import { accessibleProgress } from "./learning/progress.service.js";
import { createLessonOrder } from "./orders/order.service.js";
import { confirmPaymentAndGrantEntitlements, rejectPayment } from "./payments/payment.service.js";
import { getStudentProfile, saveStudentProfile, requireCompletedProfile } from "./students/student-profile.service.js";
import { enrollStudent, getEnrollment, listEnrollments, touchEnrollment, unenrollStudent } from "./students/enrollment.service.js";
import { courseState, dashboard, learningHistory } from "./students/student-learning.service.js";
import { changeAdminEnrolment, listStudents, studentDetail, studentHistory, studentProgress, studentResults, updateAdminEnrolment } from "./students/student-admin.service.js";
import siteRoutes from "./site/routes.js";
import directPayRoutes from "./integrations/directpay/routes.js";
import { PERMISSIONS } from "../security/permissions.js";
import { audit, requirePermission, requirePermissionForTrack } from "../security/authorization.js";
import { createContentAdminRouter } from "./content/admin-content.routes.js";
import { isPremium } from "./content/activity-registry.js";
import { publishedWhere } from "./content/content.service.js";
import studentPlayerRoutes from "./learning/student-player.routes.js";
import { createQuestionBankRouter } from "./question-bank/question-bank.routes.js";
import { createQuizRouter } from "./quiz/quiz.routes.js";
import { createQuizAttemptRouter } from "./quiz/quiz-attempt.routes.js";
import completionGradebookRoutes from "./learning/completion-gradebook.routes.js";
import commerceRoutes from "./commerce/commerce.routes.js";
// API composition point. Feature routes can later move into dedicated routers
// without changing the versioned public contract.
const router = Router(),
  admin = [authenticate, authorize("admin", "super_admin")],
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.maxDocumentUploadBytes },
  });

// Successful responses always use the same envelope for Web and Admin clients.
const send = (res, data, status = 200) => res.status(status).json({ data });
const resourceAuth = [authenticate, requirePermission(PERMISSIONS.RESOURCES_READ)];
const safeResourceWhere = (query) => {
  const where = {};
  for (const key of ["category", "visibility", "accessPolicy", "status", "mimeType", "uploadedByUserId"]) if (query[key]) where[key] = query[key];
  if (query.uploadedBy) where.uploadedByUserId = query.uploadedBy;
  if (query.search) where[Op.or] = [{ displayName: { [Op.like]: `%${query.search}%` } }, { originalFilename: { [Op.like]: `%${query.search}%` } }];
  if (query.createdFrom || query.createdUntil) where.createdAt = { ...(query.createdFrom ? { [Op.gte]: new Date(query.createdFrom) } : {}), ...(query.createdUntil ? { [Op.lte]: new Date(query.createdUntil) } : {}) };
  return where;
};

// Register authentication before feature routes that use its middleware.
authRoutes(router);
router.use(siteRoutes);
router.use(directPayRoutes);

const educatorInclude = [{ model: db.Role, attributes: ["code", "name"] }, { model: db.EducatorAssignment, as: "EducatorAssignments", required: false }];
const asEducator = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, roles: (user.Roles || []).map((role) => role.code), status: user.status, assignedCourseCount: (user.EducatorAssignments || []).filter((item) => item.status === "active").length, lastLoginAt: user.lastLoginAt || null });
const assignmentInclude = [{ model: db.User, as: "Educator", attributes: ["id", "name", "email", "status"] }, { model: db.Course, attributes: ["id", "title", "titleEn"] }, { model: db.CourseTrack, include: [db.Medium, { model: db.Course, attributes: ["id", "title", "titleEn"] }] }];
const canAssignSuperAdmin = (req, roleCode) => roleCode !== "super_admin" || req.user.role === "super_admin";
const activeSuperAdminCount = () => db.User.count({ where: { role: "super_admin", status: "active" } });

router.get("/admin/roles", authenticate, requirePermission(PERMISSIONS.ROLES_READ), asyncHandler(async (_req, res) => send(res, await db.Role.findAll({ include: [{ model: db.Permission, attributes: ["id", "code", "name", "module"] }], order: [["name", "ASC"]] }))));
router.get("/admin/permissions", authenticate, requirePermission(PERMISSIONS.ROLES_READ), asyncHandler(async (_req, res) => send(res, await db.Permission.findAll({ order: [["module", "ASC"], ["code", "ASC"]] }))));
router.get("/admin/roles/:roleId/permissions", authenticate, requirePermission(PERMISSIONS.ROLES_READ), asyncHandler(async (req, res) => { const role = await db.Role.findByPk(req.params.roleId, { include: [db.Permission] }); if (!role) throw new ApiError(404, "Role not found"); send(res, role.Permissions); }));
router.get("/admin/educators", authenticate, requirePermission(PERMISSIONS.EDUCATORS_READ), asyncHandler(async (_req, res) => { const users = await db.User.findAll({ where: { role: ["teacher", "content_editor", "admin", "super_admin"] }, include: educatorInclude, order: [["name", "ASC"]] }); send(res, users.map(asEducator)); }));
router.get("/admin/educators/:userId", authenticate, requirePermission(PERMISSIONS.EDUCATORS_READ), asyncHandler(async (req, res) => { const user = await db.User.findByPk(req.params.userId, { include: educatorInclude }); if (!user) throw new ApiError(404, "Educator not found"); send(res, asEducator(user)); }));
router.patch("/admin/educators/:userId/role", authenticate, requirePermission(PERMISSIONS.EDUCATORS_ASSIGN), asyncHandler(async (req, res) => {
  const { role: roleCode, status } = req.body; const user = await db.User.findByPk(req.params.userId); const role = await db.Role.findOne({ where: { code: roleCode, isActive: true } });
  if (!user || !role) throw new ApiError(422, "A valid educator and role are required");
  if (!canAssignSuperAdmin(req, roleCode)) throw new ApiError(403, "Only a super administrator can assign that role");
  if (user.role === "super_admin" && (roleCode !== "super_admin" || status === "disabled") && await activeSuperAdminCount() <= 1) throw new ApiError(422, "The final active super administrator cannot be removed");
  await db.sequelize.transaction(async (transaction) => { await user.update({ role: roleCode, ...(status ? { status } : {}) }, { transaction }); await db.UserRole.destroy({ where: { userId: user.id }, transaction }); await db.UserRole.create({ userId: user.id, roleId: role.id }, { transaction }); });
  await audit(req, status === "disabled" ? "user_deactivated" : "role_changed", "user", user.id, { role: roleCode }); send(res, { id: user.id, role: roleCode, status: status || user.status });
}));
router.get("/admin/educator-assignments", authenticate, requirePermission(PERMISSIONS.EDUCATORS_READ), asyncHandler(async (_req, res) => send(res, await db.EducatorAssignment.findAll({ include: assignmentInclude, order: [["createdAt", "DESC"]] }))));
router.post("/admin/educator-assignments", authenticate, requirePermission(PERMISSIONS.EDUCATORS_ASSIGN), asyncHandler(async (req, res) => {
  const values = Object.fromEntries(["userId", "courseId", "courseTrackId", "assignmentRole", "canManageContent", "canManageQuestions", "canManageQuizzes", "canGradeAssignments", "canViewStudents"].filter((key) => key in req.body).map((key) => [key, req.body[key]]));
  if (!values.userId || !values.assignmentRole || (!values.courseId && !values.courseTrackId) || !["teacher", "content_editor"].includes(values.assignmentRole)) throw new ApiError(422, "Educator, assignment role, and a course or track are required");
  const [user, course, track] = await Promise.all([db.User.findByPk(values.userId), values.courseId ? db.Course.findByPk(values.courseId) : null, values.courseTrackId ? db.CourseTrack.findByPk(values.courseTrackId) : null]);
  if (!user || (values.courseId && !course) || (values.courseTrackId && !track) || (track && values.courseId && track.courseId !== values.courseId)) throw new ApiError(422, "The selected educator, course, or track is invalid");
  const duplicate = await db.EducatorAssignment.findOne({ where: { userId: values.userId, courseId: values.courseId || null, courseTrackId: values.courseTrackId || null, assignmentRole: values.assignmentRole, status: "active" } });
  if (duplicate) throw new ApiError(409, "An active assignment already exists");
  const assignment = await db.EducatorAssignment.create({ ...values, assignedByUserId: req.user.sub, assignedAt: new Date() }); await audit(req, "educator_assigned", "educator_assignment", assignment.id, { userId: assignment.userId, courseId: assignment.courseId, courseTrackId: assignment.courseTrackId }); send(res, assignment, 201);
}));
router.patch("/admin/educator-assignments/:id", authenticate, requirePermission(PERMISSIONS.EDUCATORS_ASSIGN), asyncHandler(async (req, res) => { const assignment = await db.EducatorAssignment.findByPk(req.params.id); if (!assignment) throw new ApiError(404, "Assignment not found"); const fields = ["canManageContent", "canManageQuestions", "canManageQuizzes", "canGradeAssignments", "canViewStudents", "status"]; await assignment.update(Object.fromEntries(fields.filter((field) => field in req.body).map((field) => [field, req.body[field]]))); await audit(req, "educator_assignment_updated", "educator_assignment", assignment.id, { status: assignment.status }); send(res, assignment); }));
router.delete("/admin/educator-assignments/:id", authenticate, requirePermission(PERMISSIONS.EDUCATORS_ASSIGN), asyncHandler(async (req, res) => { const assignment = await db.EducatorAssignment.findByPk(req.params.id); if (!assignment) throw new ApiError(404, "Assignment not found"); await assignment.update({ status: "inactive" }); await audit(req, "educator_assignment_removed", "educator_assignment", assignment.id); send(res, { id: assignment.id, status: assignment.status }); }));

// Educator workspaces expose only explicitly assigned tracks. Privileged roles retain operational access.
router.get("/educator/tracks", authenticate, requirePermission(PERMISSIONS.TRACKS_READ), asyncHandler(async (req, res) => { const where = req.user.role === "admin" || req.user.role === "super_admin" ? {} : { userId: req.user.sub, status: "active" }; const assignments = await db.EducatorAssignment.findAll({ where, include: [{ model: db.CourseTrack, include: [db.Medium, db.Course] }] }); send(res, assignments.map((assignment) => ({ assignmentId: assignment.id, capabilities: { canManageContent: assignment.canManageContent, canManageQuestions: assignment.canManageQuestions, canManageQuizzes: assignment.canManageQuizzes, canGradeAssignments: assignment.canGradeAssignments, canViewStudents: assignment.canViewStudents }, track: assignment.CourseTrack }))); }));
router.get("/educator/tracks/:trackId", ...requirePermissionForTrack(PERMISSIONS.TRACKS_READ), asyncHandler(async (req, res) => { const track = await db.CourseTrack.findByPk(req.params.trackId, { include: [db.Course, db.Medium] }); if (!track) throw new ApiError(404, "Course track not found"); send(res, track); }));
router.patch("/educator/tracks/:trackId/content", ...requirePermissionForTrack(PERMISSIONS.LESSONS_UPDATE, "canManageContent"), asyncHandler(async (req, res) => { const track = await db.CourseTrack.findByPk(req.params.trackId); if (!track) throw new ApiError(404, "Course track not found"); const { title, status } = req.body; await track.update(Object.fromEntries([["title", title], ["status", status]].filter(([, value]) => value !== undefined))); send(res, track); }));

// Task 03 management endpoints enforce both granular permissions and educator
// course-track assignments. Legacy /admin/sections remains below for clients
// that have not yet moved to the Learning Activity label.
router.use(createContentAdminRouter());
router.use(createQuestionBankRouter());
router.use(createQuizRouter());
router.use(createQuizAttemptRouter());
router.use(completionGradebookRoutes);
router.use(studentPlayerRoutes);
router.use(commerceRoutes);

router.get("/student/profile", authenticate, asyncHandler(async (req, res) => send(res, await getStudentProfile(req.user.sub))));
router.patch("/student/profile", authenticate, asyncHandler(async (req, res) => send(res, await saveStudentProfile(req.user.sub, req.body))));
router.get("/student/enrolments", authenticate, asyncHandler(async (req, res) => send(res, await listEnrollments(req.user.sub))));
router.get("/student/enrollments", authenticate, asyncHandler(async (req, res) => send(res, await listEnrollments(req.user.sub))));
router.get("/student/courses/:courseTrackId/enrolment", authenticate, asyncHandler(async (req, res) => send(res, await getEnrollment(req.user.sub, req.params.courseTrackId))));
router.get("/courses/:courseId/enrollment", authenticate, asyncHandler(async (req, res) => send(res, await getEnrollment(req.user.sub, req.params.courseId))));
router.post("/student/courses/:courseTrackId/enrol", authenticate, asyncHandler(async (req, res) => send(res, await enrollStudent(req.user.sub, req.params.courseTrackId), 201)));
router.post("/courses/:courseId/enroll", authenticate, asyncHandler(async (req, res) => send(res, await enrollStudent(req.user.sub, req.params.courseId), 201)));
router.delete("/student/courses/:courseTrackId/enrolment", authenticate, asyncHandler(async (req, res) => send(res, await unenrollStudent(req.user.sub, req.params.courseTrackId))));
router.delete("/courses/:courseId/enrollment", authenticate, asyncHandler(async (req, res) => send(res, await unenrollStudent(req.user.sub, req.params.courseId))));
router.get("/student/dashboard", authenticate, asyncHandler(async (req, res) => { await requireCompletedProfile(req.user.sub); send(res, await dashboard(req.user.sub)); }));
router.get("/student/courses/:courseTrackId/state", authenticate, asyncHandler(async (req, res) => send(res, await courseState(req.user.sub, req.params.courseTrackId))));
router.get("/student/learning-history", authenticate, asyncHandler(async (req, res) => send(res, await learningHistory(req.user.sub, req.query))));

const sectionAccessPolicy = (section) =>
  isPremium(section.accessPolicy) ? "premium" : "free";

const lessonContent = (lesson) => (lesson.LessonSections || []).filter(
  // Legacy sections have no topic and stay visible; a grouped activity is only
  // public when its Topic was also included by the published visibility rules.
  (section) => !section.topicId || section.Topic,
);

const contentCounts = (lesson) => {
  const sections = lessonContent(lesson);
  return {
    freeContentCount: sections.filter(
      (section) => sectionAccessPolicy(section) === "free",
    ).length,
    paidContentCount: sections.filter(
      (section) => sectionAccessPolicy(section) === "premium",
    ).length,
  };
};

const publicProduct = (lesson) => {
  const product = (lesson.Products || []).find(
    (candidate) => ["active", "published"].includes(candidate.status),
  );
  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    currency: product.currency,
  };
};

// Public catalogue endpoints intentionally return only published records.
const publicTrack = (track) => {
  const content = (track.Lessons || []).flatMap(lessonContent);
  const freeContentCount = content.filter(
    (section) => sectionAccessPolicy(section) === "free",
  ).length;
  const paidContentCount = content.filter(
    (section) => sectionAccessPolicy(section) === "premium",
  ).length;

  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    titleEn: track.Course?.titleEn || track.Course?.title || track.title,
    titleSi: track.Course?.titleSi || null,
    shortDescription: track.Course?.shortDescriptionEn || track.Course?.description || "",
    shortDescriptionEn: track.Course?.shortDescriptionEn || track.Course?.description || "",
    shortDescriptionSi: track.Course?.shortDescriptionSi || null,
    description: track.Course?.description || track.Course?.shortDescriptionEn || "",
    medium: track.Medium,
    academicLevel: track.Course?.AcademicLevel
      ? {
          code: track.Course.AcademicLevel.code,
          nameEn: track.Course.AcademicLevel.nameEn,
          nameSi: track.Course.AcademicLevel.nameSi,
        }
      : null,
    courseGroup: track.Course?.courseGroup || null,
    availabilityStatus: track.availabilityStatus || "active",
    isFeatured: Boolean(track.Course?.isFeatured),
    isPublic: Boolean(track.isPublic ?? track.Course?.isPublic),
    enrolmentOpen: track.availabilityStatus !== "inactive",
    sortOrder: track.sortOrder,
    // Active published tracks expose their published syllabus and can be
    // enrolled in. Inactive tracks are not publicly listed.
    syllabusLessonCount: track.Lessons?.length || 0,
    freeContentCount,
    paidContentCount,
    // These aliases preserve the existing web client contract while its labels
    // move from generic activities to free and premium content.
    freeActivityCount: freeContentCount,
    paidActivityCount: paidContentCount,
  };
};

const publicCourseInclude = () => [
  {
    model: db.Course,
    where: { status: "published", isPublic: true },
    include: [db.AcademicLevel],
  },
  db.Medium,
  publishedLessonInclude(),
];

const publicTrackWhere = (query) => {
  const where = { status: "published", isPublic: true, availabilityStatus: "active" };
  const academicLevel = query.academicLevel || query.level;
  const allowedAreas = new Set(["AL", "OL", "SCHOOL"]);
  const allowedMedia = new Set(["sinhala", "english"]);
  if (academicLevel && !allowedAreas.has(academicLevel))
    throw new ApiError(422, "Invalid academicLevel filter");
  if (query.grade && !/^(6|7|8|9|10|11)$/.test(query.grade))
    throw new ApiError(422, "Invalid grade filter");
  if (query.medium && !allowedMedia.has(query.medium))
    throw new ApiError(422, "Invalid medium filter");
  if (query.availability && query.availability !== "active") throw new ApiError(422, "Only active tracks are available publicly");
  if (query.featured && !["true", "false"].includes(query.featured)) throw new ApiError(422, "Invalid featured filter");
  if (query.availability) where.availabilityStatus = query.availability;
  if (query.medium) where["$Medium.code$"] = query.medium;
  if (academicLevel) where["$Course.courseGroup$"] = academicLevel;
  if (query.grade) where["$Course.AcademicLevel.code$"] = `GRADE_${query.grade}`;
  if (query.featured === "true") where["$Course.isFeatured$"] = true;
  return where;
};

const publicLesson = (lesson) => {
  const { freeContentCount, paidContentCount } = contentCounts(lesson);

  return {
    id: lesson.id,
    slug: lesson.slug,
    lessonNumber: lesson.lessonNumber,
    title: lesson.title,
    shortDescription: lesson.summary,
    tutorialImageResourceId: lesson.tutorialImageResourceId || null,
    estimatedPeriods: lesson.estimatedPeriods,
    displayOrder: lesson.sortOrder,
    hasFreeContent: freeContentCount > 0,
    hasPaidContent: paidContentCount > 0,
    freeContentCount,
    paidContentCount,
    publishedTopicCount: lesson.Topics?.length || 0,
    isLocked: freeContentCount === 0 && paidContentCount > 0,
    purchaseAvailable: paidContentCount > 0,
    unlockProduct: publicProduct(lesson),
    activities: lessonContent(lesson).map((section) => ({
      id: section.id,
      title: section.title || section.type,
      activityType: section.type,
      accessPolicy: sectionAccessPolicy(section),
      displayOrder: section.sortOrder,
      isLocked: sectionAccessPolicy(section) === "premium",
    })),
  };
};

const publishedLessonInclude = () => ({
  model: db.Lesson,
  where: publishedWhere(),
  required: false,
  include: [
    {
      model: db.LessonSection,
      where: publishedWhere(),
      required: false,
      include: [{ model: db.Topic, where: publishedWhere(), required: false }],
    },
    {
      model: db.Product,
      where: { status: ["active", "published"] },
      required: false,
    },
    {
      model: db.Topic,
      where: publishedWhere(),
      required: false,
    },
  ],
});

const safeLearningContent = (section, isUnlocked, progress) => {
  const isLocked = sectionAccessPolicy(section) === "premium" && !isUnlocked;
  return {
    id: section.id,
    title: section.titleEn || section.title,
    titleEn: section.titleEn || section.title,
    titleSi: section.titleSi || null,
    descriptionEn: section.descriptionEn || null,
    descriptionSi: section.descriptionSi || null,
    contentType: section.type,
    accessLevel: sectionAccessPolicy(section),
    accessPolicy: sectionAccessPolicy(section),
    completionMode: section.completionMode || "none",
    estimatedMinutes: section.estimatedMinutes || null,
    sortOrder: section.sortOrder,
    isLocked,
    progress: progress || { status: "not_started" },
    // Content bodies and URLs are only returned once the server grants access.
    ...(isLocked ? {} : { content: section.content, youtubeUrl: section.youtubeUrl, externalUrl: section.externalUrl, resourceId: section.resourceId, config: section.config, instructions: section.instructions }),
  };
};

const lessonTopics = async (lesson, userId) => {
  const [topics, contentProgress, unlocked] = await Promise.all([
    db.Topic.findAll({
      where: { lessonId: lesson.id, ...publishedWhere() },
      include: [{ model: db.LessonSection, where: publishedWhere(), required: false }],
      order: [["sortOrder", "ASC"], [db.LessonSection, "sortOrder", "ASC"]],
    }),
    userId
      ? db.ContentProgress.findAll({ where: { userId } })
      : Promise.resolve([]),
    userId ? canAccessLesson(userId, lesson) : Promise.resolve(false),
  ]);
  const progressByContent = new Map(contentProgress.map((item) => [item.lessonSectionId, item]));
  const mapped = topics.map((topic) => ({
    id: topic.id,
    title: topic.titleEn || topic.title,
    titleEn: topic.titleEn || topic.title,
    titleSi: topic.titleSi || null,
    descriptionEn: topic.descriptionEn || null,
    descriptionSi: topic.descriptionSi || null,
    sortOrder: topic.sortOrder,
    contentItems: (topic.LessonSections || []).map((section) =>
      safeLearningContent(section, unlocked, progressByContent.get(section.id)),
    ),
  }));
  // Existing published content predates topics. It remains available as one
  // clearly named fallback topic rather than being hidden or fabricated.
  const ungrouped = (lesson.LessonSections || []).filter((section) => !section.topicId);
  if (ungrouped.length)
    mapped.unshift({
      id: `legacy-${lesson.id}`,
      title: "Lesson content",
      titleEn: "Lesson content",
      titleSi: null,
      descriptionEn: null,
      descriptionSi: null,
      sortOrder: 0,
      contentItems: ungrouped.map((section) =>
        safeLearningContent(section, unlocked, progressByContent.get(section.id)),
      ),
    });
  return { topics: mapped, premiumUnlocked: unlocked };
};

router.get(
  "/public/courses",
  asyncHandler(async (req, res) => {
    const tracks = await db.CourseTrack.findAll({
      where: publicTrackWhere(req.query),
      include: publicCourseInclude(),
      order: [["sortOrder", "ASC"]],
    });
    send(res, tracks.map(publicTrack));
  }),
);
router.get(
  "/public/courses/:slug",
  asyncHandler(async (req, res) => {
    const track = await db.CourseTrack.findOne({
      where: { slug: req.params.slug, status: "published", isPublic: true, availabilityStatus: "active" },
      include: publicCourseInclude(),
    });
    if (!track) throw new ApiError(404, "Course track not found");
    send(res, publicTrack(track));
  }),
);
router.get(
  "/public/courses/:slug/curriculum",
  asyncHandler(async (req, res) => {
    const track = await db.CourseTrack.findOne({
      where: { slug: req.params.slug, status: "published", isPublic: true, availabilityStatus: "active" },
      include: publicCourseInclude(),
      order: [[db.Lesson, "sortOrder", "ASC"]],
    });
    if (!track) throw new ApiError(404, "Course track not found");
    send(res, {
      ...publicTrack(track),
      // Keep the syllabus available for coming-soon tracks. Individual lesson
      // delivery remains restricted to active tracks by the lesson endpoint.
      lessons: (track.Lessons || []).map(publicLesson),
    });
  }),
);
router.get(
  "/public/courses/:courseSlug/lessons/:lessonSlug",
  optionallyAuthenticate,
  asyncHandler(async (req, res) => {
    const track = await db.CourseTrack.findOne({
      where: { slug: req.params.courseSlug, status: "published", isPublic: true, availabilityStatus: "active" },
      include: publicCourseInclude(),
    });
    if (!track) throw new ApiError(404, "Course not found");
    const lesson = await db.Lesson.findOne({
      where: { trackId: track.id, slug: req.params.lessonSlug, ...publishedWhere() },
      include: [
        { model: db.LessonSection, where: publishedWhere(), required: false, include: [{ model: db.Topic, where: publishedWhere(), required: false }] },
        { model: db.Product, where: { status: ["active", "published"] }, required: false },
      ],
    });
    if (!lesson) throw new ApiError(404, "Lesson not found");
    const { topics, premiumUnlocked } = await lessonTopics(lesson, req.user?.sub);
    const summary = publicLesson(lesson);
    send(res, {
      course: publicTrack(track),
      lesson: {
        ...summary,
        titleEn: lesson.title,
        titleSi: null,
        descriptionEn: lesson.summary,
        descriptionSi: null,
        topicCount: topics.length,
        premiumUnlocked,
        topics,
      },
    });
  }),
);

// Anyone can browse the catalog. Free files download without creating an account.
router.get(
  "/public/downloads",
  asyncHandler(async (req, res) =>
    send(res, await findPublishedDownloads(req.query)),
  ),
);

// A paid item stays visible in the same catalog but requires a signed-in learner
// before its file is streamed. A future purchase entitlement check belongs here.
router.get(
  "/public/downloads/:id/download",
  optionallyAuthenticate,
  asyncHandler(async (req, res) => {
    const download = await findPublishedDownload(req.params.id);
    if (!download) throw new ApiError(404, "Downloadable resource not found");
    if (download.accessPolicy === "paid") {
      if (!req.user) throw new ApiError(401, "Sign in is required for this paid resource");
      // DownloadableResource currently has no lesson/product entitlement relation.
      // Deny by default until that explicit relation is added; frontend locks are
      // never treated as authorization.
      throw new ApiError(403, "Paid resource entitlement is not configured");
    }

    return streamResource(req, res, download.Resource, { download: true });
  }),
);

router.get(
  "/categories",
  asyncHandler(async (req, res) =>
    send(
      res,
      await db.Category.findAll({
        where: { status: "published" },
        order: [["sortOrder", "ASC"]],
      }),
    ),
  ),
);
router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const where = { status: "published" };
    if (req.query.category) where.categoryId = req.query.category;
    send(
      res,
      await db.Course.findAll({
        where,
        include: [db.Category],
        order: [["sortOrder", "ASC"]],
      }),
    );
  }),
);
router.get(
  "/courses/:slug",
  asyncHandler(async (req, res) => {
    const course = await db.Course.findOne({
      where: { slug: req.params.slug },
      include: [db.Category],
    });
    if (!course) throw new ApiError(404, "Course not found");
    send(res, course);
  }),
);
router.get(
  "/courses/:slug/curriculum",
  asyncHandler(async (req, res) => {
    const course = await db.Course.findOne({
      where: { slug: req.params.slug },
    });
    if (!course) throw new ApiError(404, "Course not found");
    send(
      res,
      await db.CourseTrack.findAll({
        where: { courseId: course.id, status: "published" },
        include: [
          { model: db.Lesson, where: { status: "published" }, required: false },
          db.Medium,
        ],
        order: [["sortOrder", "ASC"]],
      }),
    );
  }),
);
router.get(
  "/lessons/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const lesson = await db.Lesson.findByPk(req.params.id, {
      include: [db.LessonSection],
    });
    if (!lesson) throw new ApiError(404, "Lesson not found");
    const premiumUnlocked = await canAccessLesson(req.user.sub, lesson);
    const visibleSections = (lesson.LessonSections || []).filter(
      (section) =>
        isPublishedSection(section) &&
        (sectionAccessPolicy(section) === "free" ? true : premiumUnlocked),
    );

    // Students can always receive the free part of a mixed-access lesson.
    // Paid sections are added only after an active entitlement is present.
    send(res, {
      ...lesson.toJSON(),
      premiumUnlocked,
      LessonSections: visibleSections,
    });
  }),
);
router.post(
  "/lessons/:id/access",
  authenticate,
  asyncHandler(async (req, res) => {
    const lesson = await db.Lesson.findByPk(req.params.id, {
      include: [db.LessonSection],
    });
    if (!lesson) throw new ApiError(404, "Lesson not found");
    const premiumUnlocked = await canAccessLesson(req.user.sub, lesson);
    send(res, {
      granted:
        premiumUnlocked ||
        (lesson.LessonSections || []).some(
          (section) =>
            isPublishedSection(section) &&
            sectionAccessPolicy(section) === "free",
        ),
      premiumUnlocked,
    });
  }),
);
router.patch(
  "/lessons/:id/progress",
  authenticate,
  asyncHandler(async (req, res) => {
    const lesson = await db.Lesson.findByPk(req.params.id, {
      include: [{ model: db.CourseTrack }],
    });
    if (!lesson) throw new ApiError(404, "Lesson not found");
    if (lesson.CourseTrack?.availabilityStatus !== "active")
      throw new ApiError(403, "Progress is unavailable for an inactive course track");
    // Clamp client input; completion is derived from the stored percentage.
    const percentage = Math.max(
      0,
      Math.min(100, Number(req.body.percentage || 0)),
    );
    const [progress] = await db.LessonProgress.findOrCreate({
      where: { userId: req.user.sub, lessonId: req.params.id },
      defaults: {
        status: percentage === 100 ? "completed" : "in_progress",
        percentage,
        lastPosition: req.body.lastPosition,
        completedAt: percentage === 100 ? new Date() : null,
      },
    });
    if (!progress.isNewRecord)
      await progress.update({
        status: percentage === 100 ? "completed" : "in_progress",
        percentage,
        lastPosition: req.body.lastPosition,
        completedAt: percentage === 100 ? new Date() : progress.completedAt,
      });
    send(res, progress);
  }),
);
router.get(
  "/learning/continue",
  authenticate,
  asyncHandler(async (req, res) =>
    send(
      res,
      await db.LessonProgress.findAll({
        where: { userId: req.user.sub },
        order: [["updatedAt", "DESC"]],
        limit: 10,
      }),
    ),
  ),
);
router.get(
  "/learning/courses/:slug/activity-progress",
  authenticate,
  asyncHandler(async (req, res) => {
    const track = await db.CourseTrack.findOne({
      where: { slug: req.params.slug, status: "published" },
      include: [
        { model: db.Course, where: { status: "published" } },
        db.Medium,
        publishedLessonInclude(),
      ],
      order: [[db.Lesson, "sortOrder", "ASC"]],
    });
    if (!track) throw new ApiError(404, "Course track not found");
    await touchEnrollment(req.user.sub, track.id);
    const sections = (track.Lessons || []).flatMap(
      (lesson) => lesson.LessonSections || [],
    );
    const progress = await db.ContentProgress.findAll({
      where: {
        userId: req.user.sub,
        lessonSectionId: sections.map((item) => item.id),
      },
    });
    const progressBySection = new Map(
      progress.map((item) => [item.lessonSectionId, item]),
    );
    const lessons = await Promise.all(
      (track.Lessons || []).map(async (lesson) => {
        const premiumUnlocked = await canAccessLesson(req.user.sub, lesson);
        const { freeContentCount, paidContentCount } = contentCounts(lesson);
        const activities = await Promise.all(
          (lesson.LessonSections || []).map(async (section) => {
            const isLocked = !(await canAccessContent(
              req.user.sub,
              lesson,
              section,
              premiumUnlocked,
            ));

            return {
              id: section.id,
              title: section.title || section.type,
              activityType: section.type,
              accessPolicy: sectionAccessPolicy(section),
              displayOrder: section.sortOrder,
              isLocked,
              // This overview is navigation/progress only. Current activity
              // content is returned by the student player detail endpoint.
              progress: progressBySection.get(section.id) || {
                status: "not_started",
              },
            };
          }),
        );
        return {
          ...publicLesson(lesson),
          isLocked:
            freeContentCount === 0 &&
            paidContentCount > 0 &&
            !premiumUnlocked,
          premiumUnlocked,
          activities,
          // The client can render a useful progress bar for every lesson instead
          // of calculating it repeatedly from the activity list.
          progress: accessibleProgress(activities),
        };
      }),
    );
    const courseProgress = accessibleProgress(
      lessons.flatMap((lesson) => lesson.activities),
    );
    send(res, {
      course: publicTrack(track),
      lessons,
      completedAccessibleActivities: courseProgress.completedActivities,
      totalAccessibleActivities: courseProgress.totalAccessibleActivities,
      progressPercent: courseProgress.progressPercent,
    });
  }),
);
router.post(
  "/learning/activities/:id/complete",
  authenticate,
  asyncHandler(async (req, res) => {
    const section = await db.LessonSection.findByPk(req.params.id);
    if (!section) throw new ApiError(404, "Content item not found");
    if (!isPublishedSection(section))
      throw new ApiError(404, "Content item not found");
    const lesson = await db.Lesson.findByPk(section.lessonId, {
      include: [{ model: db.CourseTrack }],
    });
    if (lesson?.CourseTrack?.availabilityStatus !== "active")
      throw new ApiError(403, "Progress is unavailable for an inactive course track");
    if (!(await canAccessContent(req.user.sub, lesson, section)))
      throw new ApiError(403, "Premium content access required");
    if (section.completionMode !== "manual")
      throw new ApiError(422, "This activity does not support manual completion");
    const [progress] = await db.ContentProgress.findOrCreate({
      where: { userId: req.user.sub, lessonSectionId: section.id },
      defaults: { status: "completed", completedAt: new Date() },
    });
    if (!progress.isNewRecord)
      await progress.update({ status: "completed", completedAt: new Date() });
    send(res, progress);
  }),
);
router.get(
  "/store/products",
  asyncHandler(async (req, res) =>
    send(res, await db.Product.findAll({ where: { status: "active" } })),
  ),
);
router.get(
  "/store/products/:slug",
  asyncHandler(async (req, res) => {
    const product = await db.Product.findOne({
      where: { slug: req.params.slug, status: "active" },
    });
    if (!product) throw new ApiError(404, "Product not found");
    // This simple digital-only product list has no inventory calculation yet.
    send(res, { ...product.toJSON(), availability: "available" });
  }),
);
router.post(
  "/orders",
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await createLessonOrder(req.user.sub, req.body.productIds, req.get("Idempotency-Key"));
    send(res, order, 201);
  }),
);
router.get(
  "/orders",
  authenticate,
  asyncHandler(async (req, res) =>
    send(
      res,
      await db.Order.findAll({
        where: { userId: req.user.sub },
        include: [db.OrderItem],
      }),
    ),
  ),
);
router.post(
  "/orders/:id/payments/bank-transfer",
  authenticate,
  upload.single("paymentSlip"),
  asyncHandler(async (req, res) => {
    const order = await db.Order.findOne({
      where: { id: req.params.id, userId: req.user.sub },
    });
    if (!order) throw new ApiError(404, "Order not found");
    if (!req.file) throw new ApiError(422, "A payment slip is required");
    const existingSubmitted = await db.Payment.findOne({ where: { orderId: order.id, status: "submitted" } });
    if (existingSubmitted) throw new ApiError(409, "Payment is already under review");
    let paymentSlipResource = null;
    if (req.file) {
      const { mimeType, extension } = validatePaymentSlip(
        req.file, env.maxPaymentSlipUploadBytes,
      );
      const id = crypto.randomUUID();
      const storageKey = await uploadStorage.savePrivateFile(
        UPLOAD_CATEGORIES.PAYMENT_SLIP, `${id}${extension}`, req.file.buffer,
      );
      try {
        paymentSlipResource = await db.Resource.create({
          id, ownerUserId: req.user.sub, uploadedByUserId: req.user.sub,
          category: "payment_slip", storedName: `${id}${extension}`, extension,
          originalFilename: req.file.originalname,
          displayName: "Payment slip",
          mimeType, sizeBytes: req.file.size, checksum: crypto.createHash("sha256").update(req.file.buffer).digest("hex"), storageKey, visibility: "private", accessPolicy: "owner_only", status: "active",
        });
      } catch (error) {
        await uploadStorage.deletePrivateFile(storageKey).catch(() => undefined);
        throw error;
      }
    }
    try {
      const payment = await db.Payment.create({
        orderId: order.id,
        amount: order.total,
        method: "bank_transfer",
        reference: req.body.reference || req.body.customerReference,
        status: "submitted",
        paymentSlipResourceId: paymentSlipResource?.id,
      });
      send(res, payment, 201);
    } catch (error) {
      if (paymentSlipResource) {
        await uploadStorage.deletePrivateFile(paymentSlipResource.storageKey).catch(() => undefined);
        await paymentSlipResource.destroy().catch(() => undefined);
      }
      throw error;
    }
  }),
);
router.get(
  "/payments/:id/slip",
  authenticate,
  asyncHandler(async (req, res) => {
    const payment = await db.Payment.findByPk(req.params.id, { include: [{ model: db.Resource, as: "PaymentSlip" }, db.Order] });
    if (!payment?.PaymentSlip) throw new ApiError(404, "Payment slip not found");
    if (!(req.user.permissions?.includes(PERMISSIONS.PAYMENTS_READ) && ["admin", "super_admin"].includes(req.user.role)) && payment.Order?.userId !== req.user.sub)
      throw new ApiError(403, "Payment slip access required");
    const data = await uploadStorage.openPrivateFile(payment.PaymentSlip.storageKey).catch((error) => {
      if (error.code === "ENOENT") throw new ApiError(404, "Payment slip not found");
      throw error;
    });
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    res.attachment(payment.PaymentSlip.originalFilename || "payment-slip");
    res.type(payment.PaymentSlip.mimeType).send(data);
  }),
);
router.get(
  "/orders/:id",
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await db.Order.findOne({
      where: { id: req.params.id, userId: req.user.sub },
      include: [db.OrderItem, db.Payment],
    });
    if (!order) throw new ApiError(404, "Order not found");
    send(res, order);
  }),
);
router.get(
  "/orders/:id/payments",
  authenticate,
  asyncHandler(async (req, res) => {
    const order = await db.Order.findOne({
      where: { id: req.params.id, userId: req.user.sub },
    });
    if (!order) throw new ApiError(404, "Order not found");
    send(res, await db.Payment.findAll({ where: { orderId: order.id } }));
  }),
);
router.get(
  "/admin/resource-categories",
  ...resourceAuth,
  asyncHandler(async (_req, res) => send(res, publicCategoryResponse())),
);
router.get(
  "/admin/resources/:id",
  ...resourceAuth,
  asyncHandler(async (req, res) => {
    const resource = await db.Resource.findByPk(req.params.id, { include: [{ model: db.ResourceLink, as: "Links" }, { model: db.Resource, as: "Replacement", required: false }] });
    if (!resource || !canManageResource(req.user, resource)) throw new ApiError(404, "Resource not found");
    send(res, resourceResponse(resource, { includeLinks: true }));
  }),
);
router.patch(
  "/admin/resources/:id",
  authenticate,
  requirePermission(PERMISSIONS.RESOURCES_UPDATE),
  asyncHandler(async (req, res) => {
    const resource = await db.Resource.findByPk(req.params.id); if (!resource || !canManageResource(req.user, resource)) throw new ApiError(404, "Resource not found");
    const values = {}; for (const key of ["displayName", "description"]) if (key in req.body) values[key] = String(req.body[key] || "").trim().slice(0, key === "description" ? 5000 : 180) || null;
    if ("visibility" in req.body || "accessPolicy" in req.body) throw new ApiError(422, "Access changes require a compatible replacement or category policy");
    if (!Object.keys(values).length) throw new ApiError(422, "No editable resource fields supplied"); await resource.update(values); await audit(req, "resource_updated", "resource", resource.id, { fields: Object.keys(values) }); send(res, resourceResponse(resource));
  }),
);
router.post(
  "/admin/resources/:id/replace",
  authenticate,
  requirePermission(PERMISSIONS.RESOURCES_UPDATE),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const resource = await db.Resource.findByPk(req.params.id); if (!resource || !canReplaceResource(req.user, resource)) throw new ApiError(404, "Resource not found");
    const replacement = await createResourceReplacement({ resource, file: req.file, user: req.user }); await audit(req, "resource_replaced", "resource", resource.id, { replacementId: replacement.id }); send(res, resourceResponse(replacement), 201);
  }),
);
router.post(
  "/admin/resources/:id/archive",
  authenticate,
  requirePermission(PERMISSIONS.RESOURCES_DELETE),
  asyncHandler(async (req, res) => {
    const resource = await db.Resource.findByPk(req.params.id); if (!resource || !canArchiveResource(req.user, resource)) throw new ApiError(404, "Resource not found"); await archiveResource(resource); await audit(req, "resource_archived", "resource", resource.id); send(res, resourceResponse(resource));
  }),
);
router.post(
  "/admin/resources/:id/links",
  authenticate,
  requirePermission(PERMISSIONS.RESOURCES_UPDATE),
  asyncHandler(async (req, res) => {
    const resource = await db.Resource.findByPk(req.params.id); if (!resource || !canManageResource(req.user, resource)) throw new ApiError(404, "Resource not found");
    const entityType = String(req.body.entityType || ""); const purpose = String(req.body.purpose || "attachment"); const entityId = req.body.entityId;
    if (!["course", "course_track", "lesson", "topic", "activity", "assignment", "submission", "payment", "site", "user"].includes(entityType) || !["thumbnail", "banner", "primary_file", "attachment", "download", "model_answer", "supporting_material", "submission", "payment_evidence"].includes(purpose) || !entityId) throw new ApiError(422, "Invalid resource link");
    const exists = await db.ResourceLink.findOne({ where: { resourceId: resource.id, entityType, entityId, purpose } }); if (exists) throw new ApiError(409, "Resource link already exists");
    const link = await db.ResourceLink.create({ resourceId: resource.id, entityType, entityId, purpose, sortOrder: Number(req.body.sortOrder) || 0, createdByUserId: req.user.sub }); await audit(req, "resource_linked", "resource", resource.id, { entityType, entityId, purpose }); send(res, link, 201);
  }),
);
router.delete(
  "/admin/resources/:id/links/:linkId",
  authenticate,
  requirePermission(PERMISSIONS.RESOURCES_UPDATE),
  asyncHandler(async (req, res) => { const resource = await db.Resource.findByPk(req.params.id); if (!resource || !canManageResource(req.user, resource)) throw new ApiError(404, "Resource not found"); const link = await db.ResourceLink.findOne({ where: { id: req.params.linkId, resourceId: resource.id } }); if (!link) throw new ApiError(404, "Resource link not found"); await link.destroy(); await audit(req, "resource_unlinked", "resource", resource.id, { linkId: link.id }); res.status(204).end(); }),
);
router.get(
  "/public/resources/:id/metadata",
  asyncHandler(async (req, res) => { const resource = await db.Resource.findByPk(req.params.id); if (!resource || resource.visibility !== "public" || resource.accessPolicy !== "public" || !["active", "ready"].includes(resource.status)) throw new ApiError(404, "Resource not found"); send(res, { id: resource.id, displayName: resource.displayName, mimeType: resource.mimeType, sizeBytes: resource.sizeBytes, category: resource.category }); }),
);
router.get(
  "/resources/:id/view",
  optionallyAuthenticate,
  asyncHandler(async (req, res) => { const resource = await db.Resource.findByPk(req.params.id); if (!resource) throw new ApiError(404, "Resource not found"); if (!(await canViewResource(req.user, resource))) { if (!req.user && resource.visibility !== "public") throw new ApiError(401, "Sign in is required"); throw new ApiError(403, "Resource access required"); } return streamResource(req, res, resource); }),
);
router.get(
  "/resources/:id/download",
  optionallyAuthenticate,
  asyncHandler(async (req, res) => { const resource = await db.Resource.findByPk(req.params.id); if (!resource) throw new ApiError(404, "Resource not found"); if (!(await canDownloadResource(req.user, resource))) { if (!req.user && resource.visibility !== "public") throw new ApiError(401, "Sign in is required"); throw new ApiError(403, "Resource access required"); } return streamResource(req, res, resource, { download: true }); }),
);
router.get(
  "/resources/:id/content",
  authenticate,
  asyncHandler(async (req, res) => {
    const resource = await db.Resource.findByPk(req.params.id);
    if (!resource) throw new ApiError(404, "Resource not found");
    if (!(await canViewResource(req.user, resource))) throw new ApiError(403, "Resource access required");
    return streamResource(req, res, resource);
  }),
);
router.post(
  "/admin/resources",
  authenticate,
  requirePermission(PERMISSIONS.RESOURCES_CREATE),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { resource, duplicateId } = await createResource({ file: req.file, body: req.body, user: req.user });
    await audit(req, "resource_uploaded", "resource", resource.id, { category: resource.category, mimeType: resource.mimeType, sizeBytes: resource.sizeBytes });
    send(res, { ...resourceResponse(resource), duplicateId }, 201);
  }),
);
// Intentionally public content is the only class that receives a stable public URL.
router.post(
  "/admin/public-images/:category",
  ...admin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    validateUpload(req.file, {
      kind: "image", maxBytes: env.maxImageUploadBytes,
    });
    const category = req.params.category;
    const buffer = await normalizePublicImage(req.file.buffer).catch(() => {
      throw new ApiError(422, "Unable to process image");
    });
    const storedName = `${crypto.randomUUID()}.webp`;
    const storageKey = await uploadStorage.savePublicImage(category, storedName, buffer);
    try {
      const resource = await db.Resource.create({
        ownerUserId: req.user.sub,
        category: "image",
        originalFilename: req.file.originalname,
        displayName: req.body.displayName || req.file.originalname,
        mimeType: "image/webp",
        sizeBytes: buffer.length,
        storageKey,
        visibility: "public",
      });
      send(res, { id: resource.id, url: uploadStorage.resolvePublicUrl(storageKey) }, 201);
    } catch (error) {
      await uploadStorage.deletePublicFile(storageKey).catch(() => undefined);
      throw error;
    }
  }),
);
router.get(
  "/admin/resources",
  ...resourceAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100); const page = Math.max(Number(req.query.page) || 1, 1);
    const result = await db.Resource.findAndCountAll({ where: safeResourceWhere(req.query), include: [{ model: db.ResourceLink, as: "Links", attributes: ["id"] }], limit, offset: (page - 1) * limit, order: [["createdAt", "DESC"]] });
    send(res, { items: result.rows.map((resource) => ({ ...resourceResponse(resource), linkedItemCount: resource.Links?.length || 0 })), pagination: { page, limit, total: result.count } });
  }),
);

// This endpoint creates both the stored file record and the public catalog entry
// in one admin action. The file remains private unless the catalog publishes it.
router.post(
  "/admin/downloadable-resources",
  ...admin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, "A file is required");

    const { mimeType, extension } = validateUpload(req.file, {
      kind: "document", maxBytes: env.maxDocumentUploadBytes, allowOffice: true,
    });

    const values = downloadableResourceInput(req.body, { creating: true });
    const fileId = crypto.randomUUID();
    const storageKey = `${UPLOAD_CATEGORIES.PAID_RESOURCE}/${fileId}${extension}`;
    let stored = false;

    try {
      await uploadStorage.savePrivateFile(
        UPLOAD_CATEGORIES.PAID_RESOURCE, `${fileId}${extension}`, req.file.buffer,
      );
      stored = true;
      const file = await db.Resource.create({
        id: fileId,
        ownerUserId: req.user.sub,
        category: mimeType === "application/pdf" ? "pdf" : "document",
        originalFilename: req.file.originalname,
        displayName: values.title,
        mimeType,
        sizeBytes: req.file.size,
        storageKey,
        visibility: "private",
      });
      const download = await db.DownloadableResource.create({
        ...values,
        resourceId: file.id,
      });
      send(
        res,
        await db.DownloadableResource.findByPk(download.id, {
          include: [db.Resource],
        }),
        201,
      );
    } catch (error) {
      // Do not leave a file behind when its catalogue metadata cannot be saved.
      if (stored) await uploadStorage.deletePrivateFile(storageKey).catch(() => undefined);
      throw error;
    }
  }),
);

router.get(
  "/admin/downloadable-resources",
  ...admin,
  asyncHandler(async (req, res) =>
    send(
      res,
      await db.DownloadableResource.findAll({
        include: [db.Resource],
        order: [
          ["sortOrder", "ASC"],
          ["createdAt", "DESC"],
        ],
      }),
    ),
  ),
);

// Metadata can be corrected or published later without uploading the file again.
router.patch(
  "/admin/downloadable-resources/:id",
  ...admin,
  asyncHandler(async (req, res) => {
    const download = await db.DownloadableResource.findByPk(req.params.id);
    if (!download) throw new ApiError(404, "Downloadable resource not found");
    const values = downloadableResourceInput(req.body);
    if (!Object.keys(values).length)
      throw new ApiError(422, "No downloadable resource fields were supplied");
    await download.update(values);
    send(
      res,
      await db.DownloadableResource.findByPk(download.id, {
        include: [db.Resource],
      }),
    );
  }),
);
// Shared CRUD helper uses an allow-list, preventing arbitrary request fields from being saved.
const crud = (pathName, Model, fields) => {
  router.get(
    `/admin/${pathName}`,
    ...admin,
    asyncHandler(async (req, res) => send(res, await Model.findAll())),
  );
  router.post(
    `/admin/${pathName}`,
    ...admin,
    asyncHandler(async (req, res) =>
      send(
        res,
        await Model.create(
          Object.fromEntries(fields.map((f) => [f, req.body[f]])),
        ),
        201,
      ),
    ),
  );
  router.patch(
    `/admin/${pathName}/:id`,
    ...admin,
    asyncHandler(async (req, res) => {
      const row = await Model.findByPk(req.params.id);
      if (!row) throw new ApiError(404, "Not found");
      await row.update(
        Object.fromEntries(
          fields.filter((f) => f in req.body).map((f) => [f, req.body[f]]),
        ),
      );
      send(res, row);
    }),
  );
};
crud("categories", db.Category, [
  "name",
  "slug",
  "description",
  "status",
  "sortOrder",
]);
crud("academic-levels", db.AcademicLevel, [
  "code",
  "nameEn",
  "nameSi",
  "sortOrder",
  "isActive",
]);
crud("media", db.Medium, [
  "code",
  "name",
  "nameEn",
  "nameSi",
  "locale",
  "sortOrder",
  "isActive",
]);
crud("courses", db.Course, [
  "categoryId",
  "academicLevelId",
  "title",
  "titleEn",
  "titleSi",
  "slug",
  "code",
  "courseGroup",
  "academicLevel",
  "description",
  "shortDescriptionEn",
  "shortDescriptionSi",
  "status",
  "sortOrder",
  "isFeatured",
  "isPublic",
  "publishedAt",
]);
crud("tracks", db.CourseTrack, [
  "courseId",
  "mediumId",
  "title",
  "slug",
  "status",
  "availabilityStatus",
  "isPublic",
  "enrolmentOpen",
  "sortOrder",
]);
crud("lessons", db.Lesson, [
  "trackId",
  "title",
  "slug",
  "lessonNumber",
  "estimatedPeriods",
  "summary",
  "accessPolicy",
  "status",
  "sortOrder",
]);
crud("topics", db.Topic, [
  "lessonId",
  "title",
  "titleEn",
  "titleSi",
  "descriptionEn",
  "descriptionSi",
  "status",
  "sortOrder",
]);
crud("sections", db.LessonSection, [
  "lessonId",
  "topicId",
  "type",
  "title",
  "titleEn",
  "titleSi",
  "descriptionEn",
  "descriptionSi",
  "accessPolicy",
  "content",
  "youtubeUrl",
  "resourceId",
  "config",
  "sortOrder",
  "isVisible",
  "status",
]);
crud("products", db.Product, [
  "lessonId",
  "name",
  "slug",
  "price",
  "currency",
  "status",
]);
router.get("/admin/students", authenticate, requirePermission(PERMISSIONS.STUDENTS_READ), asyncHandler(async (req, res) => send(res, await listStudents(req.user, req.query))));
router.get("/admin/students/:studentId", authenticate, requirePermission(PERMISSIONS.STUDENTS_READ), asyncHandler(async (req, res) => send(res, await studentDetail(req.user, req.params.studentId, req.query.courseTrackId))));
router.get("/admin/students/:studentId/enrolments", authenticate, requirePermission(PERMISSIONS.ENROLLMENTS_READ), asyncHandler(async (req, res) => send(res, (await studentDetail(req.user, req.params.studentId, req.query.courseTrackId)).enrolments)));
router.post("/admin/students/:studentId/enrolments", authenticate, requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE), asyncHandler(async (req, res) => { const entry = await updateAdminEnrolment(req.user, req.params.studentId, req.body); await audit(req, "student_enrolment_added", "enrolment", entry.id, { studentId: req.params.studentId, courseTrackId: req.body.courseTrackId, enrolmentType: entry.enrolmentType }); send(res, entry, 201); }));
router.patch("/admin/enrolments/:enrolmentId", authenticate, requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE), asyncHandler(async (req, res) => { const entry = await changeAdminEnrolment(req.user, req.params.enrolmentId, req.body.status); await audit(req, "student_enrolment_updated", "enrolment", entry.id, { status: entry.status }); send(res, entry); }));
router.get("/admin/students/:studentId/progress", authenticate, requirePermission(PERMISSIONS.PROGRESS_READ), asyncHandler(async (req, res) => send(res, await studentProgress(req.user, req.params.studentId, req.query.courseTrackId))));
router.get("/admin/students/:studentId/results", authenticate, requirePermission(PERMISSIONS.GRADES_READ), asyncHandler(async (req, res) => send(res, await studentResults(req.user, req.params.studentId, req.query.courseTrackId))));
router.get("/admin/students/:studentId/learning-history", authenticate, requirePermission(PERMISSIONS.STUDENTS_READ), asyncHandler(async (req, res) => send(res, await studentHistory(req.user, req.params.studentId, req.query))));
router.get(
  "/admin/orders",
  ...admin,
  asyncHandler(async (req, res) =>
    send(res, await db.Order.findAll({ include: [db.OrderItem, db.Payment] })),
  ),
);
router.get(
  "/admin/payments",
  ...admin,
  asyncHandler(async (req, res) => {
    const payments = await db.Payment.findAll({
      include: [{
        model: db.Order,
        include: [
          { model: db.User, include: [db.StudentProfile] },
          { model: db.OrderItem, include: [db.Product, db.Lesson] },
        ],
      }],
      order: [["createdAt", "DESC"]],
    });
    send(res, payments.map((payment) => ({
      ...payment.toJSON(),
      orderNumber: payment.Order?.orderNumber,
      student: payment.Order?.User ? {
        name: payment.Order.User.name,
        email: payment.Order.User.email,
        mobileNumber: payment.Order.User.StudentProfile?.mobileNumber || null,
        whatsAppNumber: payment.Order.User.StudentProfile?.whatsAppNumber || null,
      } : null,
      items: (payment.Order?.OrderItems || []).map((item) => ({
        id: item.id, name: item.name, unitPrice: item.unitPrice,
        product: item.Product?.name, lesson: item.Lesson?.title,
      })),
      expectedTotal: payment.Order?.total,
    })));
  }),
);
router.post(
  "/admin/payments/:id/confirm",
  ...admin,
  asyncHandler(async (req, res) => {
    send(res, await confirmPaymentAndGrantEntitlements(req.params.id, req.user.sub));
  }),
);
router.post(
  "/admin/payments/:id/reject",
  ...admin,
  asyncHandler(async (req, res) => send(res, await rejectPayment(req.params.id, req.user.sub, req.body.rejectionReason))),
);
export default router;
