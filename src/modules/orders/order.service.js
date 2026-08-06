import crypto from "crypto";
import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";

/** Create an order and immutable line-item prices in a single database transaction. */
export const createLessonOrder = async (userId, productIds, idempotencyKey) => {
  if (!idempotencyKey) throw new ApiError(422, "An idempotency key is required");
  const existing = await db.Order.findOne({ where: { userId, idempotencyKey } });
  if (existing) return existing;
  const products = await db.Product.findAll({
    where: { id: productIds || [], status: "active" },
    include: [{ model: db.Lesson, include: [db.CourseTrack] }],
  });
  if (!products.length) throw new ApiError(422, "No valid products");
  if (
    products.some(
      (product) => product.Lesson?.CourseTrack?.availabilityStatus === "coming_soon",
    )
  )
    throw new ApiError(403, "Purchases are unavailable for coming-soon courses");

  // Prices come only from active products in MariaDB, never from client input.
  // This compatibility endpoint predates the single-product Exam Success Pack
  // route; keep its arithmetic decimal-safe by adding integer LKR cents.
  const toMinor = (value) => { const [whole, fraction = ""] = String(value).split("."); return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2)); };
  const fromMinor = (value) => `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
  const totalMinor = products.reduce((sum, product) => sum + toMinor(product.price), 0n);
  const total = fromMinor(totalMinor);
  return db.sequelize.transaction(async (transaction) => {
    const order = await db.Order.create(
      {
        userId,
        orderNumber: `APL-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`,
        subtotal: total,
        discountTotal: "0.00",
        total,
        currency: "LKR",
        idempotencyKey,
        status: "payment_pending",
        paymentStatus: "unpaid",
      },
      { transaction },
    );
    await db.OrderItem.bulkCreate(
      products.map((product) => ({
        orderId: order.id,
        productId: product.id,
        lessonId: product.lessonId,
        name: product.name,
        productNameSnapshot: product.name,
        productTypeSnapshot: product.productType || "lesson_exam_success_pack",
        courseId: product.courseId || product.Lesson?.CourseTrack?.courseId || null,
        courseTrackId: product.courseTrackId || product.Lesson?.trackId || null,
        currency: "LKR",
        unitPrice: product.price,
        quantity: 1,
        lineTotal: product.price,
      })),
      { transaction },
    );
    return order;
  });
};
