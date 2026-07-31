import crypto from "crypto";
import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";

/** Create an order and immutable line-item prices in a single database transaction. */
export const createLessonOrder = async (userId, productIds) => {
  const products = await db.Product.findAll({
    where: { id: productIds || [], status: "active" },
  });
  if (!products.length) throw new ApiError(422, "No valid products");

  // Prices come only from active products in MariaDB, never from client input.
  const total = products.reduce(
    (sum, product) => sum + Number(product.price),
    0,
  );
  return db.sequelize.transaction(async (transaction) => {
    const order = await db.Order.create(
      {
        userId,
        orderNumber: `APL-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`,
        total,
        currency: "LKR",
      },
      { transaction },
    );
    await db.OrderItem.bulkCreate(
      products.map((product) => ({
        orderId: order.id,
        productId: product.id,
        lessonId: product.lessonId,
        name: product.name,
        unitPrice: product.price,
      })),
      { transaction },
    );
    return order;
  });
};
