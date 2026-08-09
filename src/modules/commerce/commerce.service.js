import crypto from "crypto";
import { Op } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { requireCompletedProfile } from "../students/student-profile.service.js";

const activeEntitlementWhere = () => ({ status: "active", [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: new Date() } }] });
const pendingTtlMinutes = Math.max(15, Number(process.env.ORDER_PENDING_EXPIRY_MINUTES || 60 * 24));
const money = (value, field = "price") => {
  const text = String(value ?? "").trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new ApiError(422, `${field} must be a non-negative LKR amount with at most two decimal places`);
  return BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
};
const amount = (minor) => `${minor / 100n}.${String(minor % 100n).padStart(2, "0")}`;
const now = () => new Date();
const isPublished = (product, date = now()) => ["published", "active"].includes(product.status) && !product.archivedAt && (!product.salesStartAt || new Date(product.salesStartAt) <= date) && (!product.salesEndAt || new Date(product.salesEndAt) >= date);
const productIncludes = [{ model: db.Course, attributes: ["id", "title", "titleEn"] }, { model: db.CourseTrack, include: [db.Medium] }, { model: db.Lesson, attributes: ["id", "title", "titleEn", "slug", "lessonNumber"] }, { model: db.ProductEntitlementRule, as: "EntitlementRules" }];

export const serializeProduct = (product, { includeRules = false } = {}) => ({
  id: product.id, productType: product.productType, name: product.name, slug: product.slug, shortDescription: product.shortDescription, description: product.description,
  status: product.status, currency: product.currency, price: product.price, compareAtPrice: product.compareAtPrice, courseId: product.courseId, courseTrackId: product.courseTrackId, lessonId: product.lessonId,
  course: product.Course && { id: product.Course.id, title: product.Course.titleEn || product.Course.title }, medium: product.CourseTrack?.Medium && { id: product.CourseTrack.Medium.id, name: product.CourseTrack.Medium.nameEn || product.CourseTrack.Medium.name }, lesson: product.Lesson && { id: product.Lesson.id, title: product.Lesson.titleEn || product.Lesson.title, slug: product.Lesson.slug, lessonNumber: product.Lesson.lessonNumber },
  entitlementDurationDays: product.entitlementDurationDays, salesStartAt: product.salesStartAt, salesEndAt: product.salesEndAt, publishedAt: product.publishedAt, archivedAt: product.archivedAt,
  ...(includeRules ? { entitlementRules: (product.EntitlementRules || []).map((rule) => ({ id: rule.id, entitlementType: rule.entitlementType, courseId: rule.courseId, courseTrackId: rule.courseTrackId, lessonId: rule.lessonId, activityId: rule.activityId, durationDays: rule.durationDays })) } : {}),
});

export const validateProductRelations = async (values, transaction) => {
  const productType = values.productType || "lesson_exam_success_pack";
  if (!Object.keys({ lesson_exam_success_pack: 1, course_exam_success_pack: 1, bundle: 1, printed_tute: 1 }).includes(productType)) throw new ApiError(422, "Unsupported product type");
  if (values.currency && values.currency !== "LKR") throw new ApiError(422, "Only LKR is supported");
  if (values.price !== undefined && money(values.price) < 0n) throw new ApiError(422, "Price cannot be negative");
  if (values.entitlementDurationDays !== undefined && values.entitlementDurationDays !== null && (!Number.isInteger(Number(values.entitlementDurationDays)) || Number(values.entitlementDurationDays) < 1)) throw new ApiError(422, "Entitlement duration must be a positive whole number of days");
  if (!values.courseId || !values.courseTrackId) throw new ApiError(422, "Course and Medium are required");
  const [course, track] = await Promise.all([db.Course.findByPk(values.courseId, { transaction }), db.CourseTrack.findByPk(values.courseTrackId, { transaction })]);
  if (!course || !track || track.courseId !== course.id) throw new ApiError(422, "The selected Course and Medium are not related");
  if (productType === "lesson_exam_success_pack") {
    if (!values.lessonId) throw new ApiError(422, "A Lesson is required for an Exam Success Pack");
    const lesson = await db.Lesson.findByPk(values.lessonId, { transaction });
    if (!lesson || lesson.trackId !== track.id) throw new ApiError(422, "The selected Lesson does not belong to the selected Medium");
  }
  return { course, track };
};

const ruleValues = (product) => ({ productId: product.id, entitlementType: "lesson_premium_access", courseId: product.courseId, courseTrackId: product.courseTrackId, lessonId: product.lessonId, activityId: null, durationDays: product.entitlementDurationDays || null });
export const saveProduct = async (body, actor, id = null) => db.sequelize.transaction(async (transaction) => {
  const existing = id ? await db.Product.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE }) : null;
  if (id && !existing) throw new ApiError(404, "Product not found");
  if (existing?.status === "archived") throw new ApiError(409, "Archived Products cannot be edited");
  const allowed = ["productType", "name", "slug", "shortDescription", "description", "currency", "price", "compareAtPrice", "courseId", "courseTrackId", "lessonId", "isFeatured", "salesStartAt", "salesEndAt", "entitlementDurationDays"];
  const values = Object.fromEntries(allowed.filter((key) => key in body).map((key) => [key, body[key] === "" ? null : body[key]]));
  const candidate = { ...(existing?.get({ plain: true }) || {}), ...values, currency: values.currency || existing?.currency || "LKR" };
  if (!candidate.name?.trim() || !candidate.slug?.trim()) throw new ApiError(422, "Product name and slug are required");
  await validateProductRelations(candidate, transaction);
  if (candidate.price === undefined || money(candidate.price) < 0n) throw new ApiError(422, "A valid price is required");
  if (candidate.compareAtPrice !== null && candidate.compareAtPrice !== undefined && money(candidate.compareAtPrice, "compareAtPrice") < money(candidate.price)) throw new ApiError(422, "Compare-at price must not be below price");
  const product = existing ? await existing.update({ ...values, currency: "LKR", updatedByUserId: actor.sub }, { transaction }) : await db.Product.create({ ...values, productType: values.productType || "lesson_exam_success_pack", currency: "LKR", status: "draft", createdByUserId: actor.sub, updatedByUserId: actor.sub }, { transaction });
  await db.ProductEntitlementRule.destroy({ where: { productId: product.id }, transaction });
  await db.ProductEntitlementRule.create(ruleValues(product), { transaction });
  return db.Product.findByPk(product.id, { include: productIncludes, transaction });
});

export const productLifecycle = async (id, action, actor) => db.sequelize.transaction(async (transaction) => {
  const product = await db.Product.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE }); if (!product) throw new ApiError(404, "Product not found");
  if (action === "publish") { await validateProductRelations(product, transaction); if (money(product.price) < 0n || !product.name || !product.slug) throw new ApiError(422, "Product requires a name, slug, price and valid lesson mapping"); await product.update({ status: "published", publishedAt: now(), archivedAt: null, updatedByUserId: actor.sub }, { transaction }); }
  else if (action === "unpublish") { if (product.status === "archived") throw new ApiError(409, "Archived Products cannot be unpublished"); await product.update({ status: "unpublished", updatedByUserId: actor.sub }, { transaction }); }
  else if (action === "archive") await product.update({ status: "archived", archivedAt: now(), updatedByUserId: actor.sub }, { transaction });
  else throw new ApiError(422, "Invalid Product lifecycle action");
  return db.Product.findByPk(product.id, { include: productIncludes, transaction });
});

export const hasPremiumAccess = async (userId, { courseId, courseTrackId, lessonId, activityId } = {}, transaction) => {
  const rows = await db.Entitlement.findAll({ where: { userId, status: "active", ...(courseId ? { courseId } : {}), ...(courseTrackId ? { courseTrackId } : {}), ...(lessonId ? { lessonId } : {}), [Op.and]: [{ [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: new Date() } }] }, ...(activityId ? [{ [Op.or]: [{ activityId }, { activityId: null }] }] : [])] }, transaction });
  return rows.some((row) => (!lessonId || row.lessonId === lessonId || !row.lessonId) && (!activityId || !row.activityId || row.activityId === activityId));
};
export const entitledLessonIds = async (userId, lessonIds, transaction) => new Set((await db.Entitlement.findAll({ where: { userId, lessonId: { [Op.in]: lessonIds }, ...activeEntitlementWhere() }, attributes: ["lessonId"], transaction })).map((row) => row.lessonId));

const expireOrder = async (order, transaction) => { if (["pending", "payment_pending", "awaiting_payment"].includes(order.status) && order.expiresAt && new Date(order.expiresAt) <= now()) { await order.update({ status: "expired" }, { transaction }); await db.OrderStatusHistory.create({ orderId: order.id, fromStatus: order.status, toStatus: "expired", paymentStatus: order.paymentStatus, reason: "pending_order_expired" }, { transaction }); return true; } return false; };
export const serializeOrder = (order, { admin = false } = {}) => ({ id: order.id, orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, currency: order.currency, subtotal: order.subtotal, discountTotal: order.discountTotal, total: order.total, createdAt: order.createdAt, updatedAt: order.updatedAt, expiresAt: order.expiresAt, cancelledAt: order.cancelledAt, completedAt: order.completedAt, ...(admin && order.User ? { student: { id: order.User.id, name: order.User.name, email: order.User.email } } : {}), items: (order.OrderItems || []).map((item) => ({ id: item.id, productId: item.productId, name: item.productNameSnapshot || item.name, productType: item.productTypeSnapshot, unitPrice: item.unitPrice, quantity: item.quantity, lineTotal: item.lineTotal, currency: item.currency, lessonId: item.lessonId })), statusHistory: (order.StatusHistory || []).map((entry) => ({ id: entry.id, fromStatus: entry.fromStatus, toStatus: entry.toStatus, paymentStatus: entry.paymentStatus, createdAt: entry.createdAt, reason: entry.reason })), entitlements: (order.Entitlements || []).map((entry) => ({ id: entry.id, status: entry.status, lessonId: entry.lessonId, expiresAt: entry.endsAt })),
});

export const createStudentOrder = async (userId, productId, idempotencyKey) => {
  if (!productId) throw new ApiError(422, "A Product is required"); await requireCompletedProfile(userId);
  return db.sequelize.transaction(async (transaction) => {
    const product = await db.Product.findByPk(productId, { include: productIncludes, transaction, lock: transaction.LOCK.UPDATE });
    if (!product || !isPublished(product)) throw new ApiError(422, "This Exam Success Pack is not available");
    await validateProductRelations(product, transaction);
    const enrollment = await db.Enrolment.findOne({ where: { userId, courseTrackId: product.courseTrackId, status: "active" }, transaction });
    if (!enrollment) throw new ApiError(403, "Free Course enrollment is required before ordering this Exam Success Pack");
    if (await hasPremiumAccess(userId, product, transaction)) throw new ApiError(409, "You already have active Exam Success Pack access for this Lesson");
    if (idempotencyKey) { const keyed = await db.Order.findOne({ where: { userId, idempotencyKey }, include: [db.OrderItem], transaction }); if (keyed) return { order: keyed, existing: true }; }
    const active = await db.Order.findAll({ where: { userId, status: ["pending", "payment_pending", "awaiting_payment"] }, include: [{ model: db.OrderItem, where: { productId }, required: true }], transaction, lock: transaction.LOCK.UPDATE });
    for (const order of active) if (!(await expireOrder(order, transaction))) return { order, existing: true };
    const unit = money(product.price), expiresAt = new Date(Date.now() + pendingTtlMinutes * 60_000);
    const order = await db.Order.create({ userId, orderNumber: `APL-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`, idempotencyKey: idempotencyKey || null, status: "payment_pending", paymentStatus: "unpaid", source: "student", currency: "LKR", subtotal: amount(unit), discountTotal: "0.00", total: amount(unit), expiresAt }, { transaction });
    await db.OrderItem.create({ orderId: order.id, productId: product.id, productNameSnapshot: product.name, productTypeSnapshot: product.productType, name: product.name, currency: "LKR", unitPrice: amount(unit), quantity: 1, lineTotal: amount(unit), courseId: product.courseId, courseTrackId: product.courseTrackId, lessonId: product.lessonId }, { transaction });
    await db.OrderStatusHistory.create({ orderId: order.id, fromStatus: null, toStatus: "payment_pending", paymentStatus: "unpaid", actorUserId: userId, reason: "student_order_created" }, { transaction });
    return { order: await db.Order.findByPk(order.id, { include: [db.OrderItem], transaction }), existing: false };
  });
};

export const listStudentOrders = async (userId, query = {}) => { const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20)); const { count, rows } = await db.Order.findAndCountAll({ where: { userId }, include: [db.OrderItem], order: [["createdAt", "DESC"]], limit: pageSize, offset: (page - 1) * pageSize }); return { items: rows.map(serializeOrder), pagination: { page, pageSize, total: count } }; };
export const studentOrder = async (userId, id) => { const order = await db.Order.findOne({ where: { id, userId }, include: [db.OrderItem, { model: db.OrderStatusHistory, as: "StatusHistory" }], order: [[{ model: db.OrderStatusHistory, as: "StatusHistory" }, "createdAt", "ASC"]] }); if (!order) throw new ApiError(404, "Order not found"); await db.sequelize.transaction((transaction) => expireOrder(order, transaction)); return serializeOrder(order); };
export const cancelStudentOrder = async (userId, id) => db.sequelize.transaction(async (transaction) => { const order = await db.Order.findOne({ where: { id, userId }, transaction, lock: transaction.LOCK.UPDATE }); if (!order) throw new ApiError(404, "Order not found"); await expireOrder(order, transaction); if (!["pending", "payment_pending", "awaiting_payment"].includes(order.status) || !["unpaid", "pending"].includes(order.paymentStatus)) throw new ApiError(409, "Only unpaid pending Orders can be cancelled"); const fromStatus = order.status; await order.update({ status: "cancelled", cancelledAt: now() }, { transaction }); await db.OrderStatusHistory.create({ orderId: id, fromStatus, toStatus: "cancelled", paymentStatus: order.paymentStatus, actorUserId: userId, reason: "student_cancelled" }, { transaction }); return serializeOrder(order); });

export const grantOrderEntitlements = async (order, actorUserId, transaction) => { const items = await db.OrderItem.findAll({ where: { orderId: order.id }, transaction }); const results = []; for (const item of items) { const rules = await db.ProductEntitlementRule.findAll({ where: { productId: item.productId }, transaction }); for (const rule of rules) { const existing = await db.Entitlement.findOne({ where: { userId: order.userId, sourceType: "order", sourceId: order.id, lessonId: rule.lessonId, entitlementType: rule.entitlementType }, transaction }); if (existing) { results.push(existing); continue; } const startsAt = now(), days = rule.durationDays ?? (await db.Product.findByPk(item.productId, { transaction }))?.entitlementDurationDays, endsAt = days ? new Date(startsAt.getTime() + Number(days) * 86400000) : null; const active = await db.Entitlement.findOne({ where: { userId: order.userId, entitlementType: rule.entitlementType, courseTrackId: rule.courseTrackId, lessonId: rule.lessonId, ...activeEntitlementWhere() }, transaction }); if (active) { results.push(active); continue; } results.push(await db.Entitlement.create({ userId: order.userId, entitlementType: rule.entitlementType, courseId: rule.courseId, courseTrackId: rule.courseTrackId, lessonId: rule.lessonId, activityId: rule.activityId, orderId: order.id, sourceType: "order", sourceId: order.id, status: "active", startsAt, endsAt, grantedBy: actorUserId }, { transaction })); } } return results; };
export const verifyOrderPayment = async (id, actorUserId) => db.sequelize.transaction(async (transaction) => { const order = await db.Order.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE }); if (!order) throw new ApiError(404, "Order not found"); if (["paid", "completed"].includes(order.status) && order.paymentStatus === "verified") return { order, entitlements: await db.Entitlement.findAll({ where: { sourceType: "order", sourceId: order.id }, transaction }), idempotent: true }; if (!["pending", "payment_pending", "awaiting_payment"].includes(order.status)) throw new ApiError(409, "Order is not eligible for manual payment verification"); const fromStatus = order.status; await order.update({ status: "completed", paymentStatus: "verified", paymentMethod: order.paymentMethod || "manual_verification", completedAt: now() }, { transaction }); const entitlements = await grantOrderEntitlements(order, actorUserId, transaction); await db.OrderStatusHistory.create({ orderId: order.id, fromStatus, toStatus: "completed", paymentStatus: "verified", actorUserId, reason: "manual_payment_verified" }, { transaction }); return { order, entitlements, idempotent: false }; });
export const listAdminOrders = async (query = {}) => { const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25)); const where = Object.fromEntries(["status", "paymentStatus"].filter((key) => query[key]).map((key) => [key, query[key]])); const { count, rows } = await db.Order.findAndCountAll({ where, include: [{ model: db.User, attributes: ["id", "name", "email"] }, db.OrderItem, { model: db.OrderStatusHistory, as: "StatusHistory", required: false }], order: [["createdAt", "DESC"]], limit: pageSize, offset: (page - 1) * pageSize, distinct: true }); return { items: rows.map((row) => serializeOrder(row, { admin: true })), pagination: { page, pageSize, total: count } }; };
export const adminOrder = async (id) => { const order = await db.Order.findByPk(id, { include: [{ model: db.User, attributes: ["id", "name", "email"] }, db.OrderItem, { model: db.OrderStatusHistory, as: "StatusHistory" }, { model: db.Entitlement, as: "Entitlements", required: false }], order: [[{ model: db.OrderStatusHistory, as: "StatusHistory" }, "createdAt", "ASC"]] }); if (!order) throw new ApiError(404, "Order not found"); return serializeOrder(order, { admin: true }); };
