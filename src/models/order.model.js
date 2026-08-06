import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineOrder = (sequelize) =>
  defineModel(sequelize, "Order", {
    userId: { type: DataTypes.UUID, allowNull: false },
    orderNumber: { type: DataTypes.STRING, unique: true },
    idempotencyKey: { type: DataTypes.STRING, unique: true },
    status: {
      type: DataTypes.ENUM("pending", "payment_pending", "paid", "completed", "cancelled", "expired", "refunded", "failed", "awaiting_payment"),
      defaultValue: "payment_pending",
    },
    paymentStatus: { type: DataTypes.ENUM("unpaid", "pending", "verified", "failed", "refunded"), allowNull: false, defaultValue: "unpaid" },
    paymentMethod: DataTypes.STRING,
    source: { type: DataTypes.STRING, defaultValue: "student" },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    discountTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "LKR" },
    cancelledAt: DataTypes.DATE,
    completedAt: DataTypes.DATE,
    expiresAt: DataTypes.DATE,
  });
