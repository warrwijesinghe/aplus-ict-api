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
    if (payment.status !== "submitted") throw new ApiError(409, "Only submitted payments can be confirmed");

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

export const rejectPayment = async (paymentId, adminUserId, rejectionReason) =>
  db.sequelize.transaction(async (transaction) => {
    if (!String(rejectionReason || "").trim())
      throw new ApiError(422, "A rejection reason is required");
    const payment = await db.Payment.findByPk(paymentId, { transaction });
    if (!payment) throw new ApiError(404, "Payment not found");
    if (payment.status === "confirmed") throw new ApiError(409, "A confirmed payment cannot be rejected");
    if (payment.status === "rejected") return payment;
    const order = await db.Order.findByPk(payment.orderId, { transaction });
    await payment.update({ status: "rejected", rejectedBy: adminUserId, rejectedAt: new Date(), rejectionReason: String(rejectionReason).trim() }, { transaction });
    await order.update({ status: "awaiting_payment" }, { transaction });
    return payment;
  });
