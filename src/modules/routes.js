import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
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
import { confirmPaymentAndGrantEntitlements } from "./payments/payment.service.js";
import { findStudentUsers } from "./users/user.service.js";
// API composition point. Feature routes can later move into dedicated routers
// without changing the versioned public contract.
const router = Router(),
  admin = [authenticate, authorize("admin")],
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.maxDocumentUploadBytes },
  });

// Successful responses always use the same envelope for Web and Admin clients.
const send = (res, data, status = 200) => res.status(status).json({ data });

// Register authentication before feature routes that use its middleware.
authRoutes(router);

const sectionAccessPolicy = (section) =>
  section.accessPolicy === "paid" ? "paid" : "free";

const isPublishedSection = (section) => section.isVisible !== false;

const lessonContent = (lesson) => lesson.LessonSections || [];

const contentCounts = (lesson) => {
  const sections = lessonContent(lesson);
  return {
    freeContentCount: sections.filter(
      (section) => sectionAccessPolicy(section) === "free",
    ).length,
    paidContentCount: sections.filter(
      (section) => sectionAccessPolicy(section) === "paid",
    ).length,
  };
};

const publicProduct = (lesson) => {
  const product = (lesson.Products || []).find(
    (candidate) => candidate.status === "active",
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
    (section) => sectionAccessPolicy(section) === "paid",
  ).length;

  return {
    id: track.id,
    slug: track.slug,
    title: track.title,
    shortDescription: track.Course?.description || "",
    description: track.Course?.description || "",
    medium: track.Medium,
    syllabusLessonCount: track.Lessons?.length || 0,
    freeContentCount,
    paidContentCount,
    // These aliases preserve the existing web client contract while its labels
    // move from generic activities to free and premium content.
    freeActivityCount: freeContentCount,
    paidActivityCount: paidContentCount,
  };
};

const publicLesson = (lesson) => {
  const { freeContentCount, paidContentCount } = contentCounts(lesson);

  return {
    id: lesson.id,
    lessonNumber: lesson.lessonNumber,
    title: lesson.title,
    shortDescription: lesson.summary,
    estimatedPeriods: lesson.estimatedPeriods,
    displayOrder: lesson.sortOrder,
    hasFreeContent: freeContentCount > 0,
    hasPaidContent: paidContentCount > 0,
    freeContentCount,
    paidContentCount,
    isLocked: freeContentCount === 0 && paidContentCount > 0,
    purchaseAvailable: paidContentCount > 0,
    unlockProduct: publicProduct(lesson),
    activities: lessonContent(lesson).map((section) => ({
      id: section.id,
      title: section.title || section.type,
      activityType: section.type,
      accessPolicy: sectionAccessPolicy(section),
      displayOrder: section.sortOrder,
      isLocked: sectionAccessPolicy(section) === "paid",
    })),
  };
};

const publishedLessonInclude = () => ({
  model: db.Lesson,
  where: { status: "published" },
  required: false,
  include: [
    {
      model: db.LessonSection,
      where: { isVisible: true },
      required: false,
    },
    {
      model: db.Product,
      where: { status: "active" },
      required: false,
    },
  ],
});

router.get(
  "/public/courses",
  asyncHandler(async (req, res) => {
    const tracks = await db.CourseTrack.findAll({
      where: { status: "published" },
      include: [
        { model: db.Course, where: { status: "published" } },
        db.Medium,
        publishedLessonInclude(),
      ],
      order: [["sortOrder", "ASC"]],
    });
    send(res, tracks.map(publicTrack));
  }),
);
router.get(
  "/public/courses/:slug",
  asyncHandler(async (req, res) => {
    const track = await db.CourseTrack.findOne({
      where: { slug: req.params.slug, status: "published" },
      include: [
        { model: db.Course, where: { status: "published" } },
        db.Medium,
        publishedLessonInclude(),
      ],
    });
    if (!track) throw new ApiError(404, "Course track not found");
    send(res, publicTrack(track));
  }),
);
router.get(
  "/public/courses/:slug/curriculum",
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
    send(res, {
      ...publicTrack(track),
      lessons: (track.Lessons || []).map(publicLesson),
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

    const file = download.Resource;
    const data = await uploadStorage.openPrivateFile(file.storageKey);
    const cacheControl =
      download.accessPolicy === "free"
        ? "public, max-age=3600"
        : "private, no-store";
    res.set("Cache-Control", cacheControl);
    res.attachment(file.originalFilename || download.title + ".pdf");
    res.type(file.mimeType || "application/octet-stream").send(data);
  }),
);

router.get("/site-profile", (req, res) =>
  send(res, {
    brandName: "A Plus ICT",
    shortDescription: "A/L ICT learning platform",
    socialLinks: [
      {
        id: "facebook",
        platform: "facebook",
        label: "Facebook",
        url: "https://www.facebook.com/APlusICTclass",
      },
      {
        id: "youtube",
        platform: "youtube",
        label: "YouTube",
        url: "https://www.youtube.com/@aplusictclass",
      },
      {
        id: "tiktok",
        platform: "tiktok",
        label: "TikTok",
        url: "https://www.tiktok.com/@aplus.ict",
      },
      {
        id: "instagram",
        platform: "instagram",
        label: "Instagram",
        url: "https://www.instagram.com/aplusict",
      },
      {
        id: "whatsapp",
        platform: "whatsapp",
        label: "WhatsApp",
        url: "https://wa.me/94717105837",
      },
    ],
    contactChannels: [
      {
        id: "whatsapp",
        label: "WhatsApp: 071 710 5837",
        value: "071 710 5837",
        publicUrl: "https://wa.me/94717105837",
      },
    ],
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
              // Locked content exposes only its label and type. The actual
              // learning material is returned only after the lesson unlock.
              ...(isLocked
                ? {}
                : {
                    content: section.content,
                    youtubeUrl: section.youtubeUrl,
                    resourceId: section.resourceId,
                    config: section.config,
                  }),
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
    const lesson = await db.Lesson.findByPk(section.lessonId);
    if (!(await canAccessContent(req.user.sub, lesson, section)))
      throw new ApiError(403, "Premium content access required");
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
    const order = await createLessonOrder(req.user.sub, req.body.productIds);
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
          id, ownerUserId: req.user.sub,
          category: mimeType.startsWith("image/") ? "image" : "pdf",
          originalFilename: req.file.originalname,
          displayName: "Payment slip",
          mimeType, sizeBytes: req.file.size, storageKey, visibility: "private",
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
    if (req.user.role !== "admin" && payment.Order?.userId !== req.user.sub)
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
  "/resources/:id/content",
  authenticate,
  asyncHandler(async (req, res) => {
    const resource = await db.Resource.findByPk(req.params.id);
    if (!resource) throw new ApiError(404, "Resource not found");
    // Storage is neutral; the linked lesson decides whether a resource can be read.
    const linked = await db.LessonSection.findOne({
      where: { resourceId: resource.id },
    });
    if (linked) {
      if (!isPublishedSection(linked))
        throw new ApiError(404, "Resource not found");
      const lesson = await db.Lesson.findByPk(linked.lessonId);
      if (!(await canAccessContent(req.user.sub, lesson, linked)))
        throw new ApiError(403, "Premium content access required");
    } else if (
      resource.ownerUserId !== req.user.sub &&
      req.user.role !== "admin"
    ) {
      // Unlinked private files can only be inspected by their uploader or an administrator.
      throw new ApiError(403, "Resource access required");
    }
    res.set("Cache-Control", "private, no-store");
    res.set("X-Content-Type-Options", "nosniff");
    const data = await uploadStorage.openPrivateFile(resource.storageKey).catch((error) => {
      if (error.code === "ENOENT") throw new ApiError(404, "Resource file not found");
      throw error;
    });
    res.type(resource.mimeType || "application/octet-stream").send(data);
  }),
);
router.post(
  "/admin/resources",
  ...admin,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(422, "File is required");
    const kind = req.file.mimetype.startsWith("image/") ? "image" : "document";
    const { mimeType, extension } = validateUpload(req.file, {
      kind,
      maxBytes: kind === "image" ? env.maxImageUploadBytes : env.maxDocumentUploadBytes,
      allowOffice: kind === "document",
    });
    const id = crypto.randomUUID();
    const storageKey = await uploadStorage.savePrivateFile(
      UPLOAD_CATEGORIES.PAID_RESOURCE, `${id}${extension}`, req.file.buffer,
    );
    try {
      const resource = await db.Resource.create({
        id, ownerUserId: req.user.sub,
        category: kind === "image" ? "image" : mimeType === "application/pdf" ? "pdf" : "document",
        originalFilename: req.file.originalname, displayName: req.body.displayName || req.file.originalname,
        mimeType, sizeBytes: req.file.size, storageKey, visibility: "private",
      });
      send(res, resource, 201);
    } catch (error) {
      await uploadStorage.deletePrivateFile(storageKey).catch(() => undefined);
      throw error;
    }
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
  ...admin,
  asyncHandler(async (req, res) => send(res, await db.Resource.findAll())),
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
crud("courses", db.Course, [
  "categoryId",
  "title",
  "slug",
  "code",
  "academicLevel",
  "description",
  "status",
  "sortOrder",
]);
crud("tracks", db.CourseTrack, [
  "courseId",
  "mediumId",
  "title",
  "slug",
  "status",
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
crud("sections", db.LessonSection, [
  "lessonId",
  "type",
  "title",
  "accessPolicy",
  "content",
  "youtubeUrl",
  "resourceId",
  "config",
  "sortOrder",
  "isVisible",
]);
crud("products", db.Product, [
  "lessonId",
  "name",
  "slug",
  "price",
  "currency",
  "status",
]);
router.get(
  "/admin/students",
  ...admin,
  asyncHandler(async (req, res) => send(res, await findStudentUsers())),
);
router.get(
  "/admin/orders",
  ...admin,
  asyncHandler(async (req, res) =>
    send(res, await db.Order.findAll({ include: [db.OrderItem, db.Payment] })),
  ),
);
router.post(
  "/admin/payments/:id/confirm",
  ...admin,
  asyncHandler(async (req, res) => {
    await confirmPaymentAndGrantEntitlements(req.params.id, req.user.sub);
    send(res, { ok: true });
  }),
);
export default router;
