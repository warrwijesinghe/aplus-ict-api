import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";

/**
 * A manual confirmation atomically marks payment/order paid and creates lesson access.
 * This replaces the former cross-service fulfilment call with one local transaction.
 */
export const confirmPaymentAndGrantEntitlements = async (
  paymentId,
  adminUserId,
) =>
  db.sequelize.transaction(async (transaction) => {
    const payment = await db.Payment.findByPk(paymentId, { transaction });
    if (!payment) throw new ApiError(404, "Payment not found");
    if (payment.status === "confirmed") return payment;

    const order = await db.Order.findByPk(payment.orderId, { transaction });
    await payment.update(
      {
        status: "confirmed",
        confirmedBy: adminUserId,
        confirmedAt: new Date(),
      },
      { transaction },
    );
    await order.update({ status: "paid" }, { transaction });

    const items = await db.OrderItem.findAll({
      where: { orderId: order.id },
      transaction,
    });
    await db.Entitlement.bulkCreate(
      items.map((item) => ({
        userId: order.userId,
        lessonId: item.lessonId,
        orderId: order.id,
        status: "active",
        startsAt: new Date(),
      })),
      { transaction, ignoreDuplicates: true },
    );
    return payment;
  });
