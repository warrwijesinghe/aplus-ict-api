import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const definePaymentTransaction = (sequelize) => defineModel(sequelize, "PaymentTransaction", {
  orderId: { type: DataTypes.UUID, allowNull: false },
  provider: { type: DataTypes.ENUM("directpay"), allowNull: false, defaultValue: "directpay" },
  providerTransactionId: DataTypes.STRING,
  providerReference: DataTypes.STRING,
  merchantReference: { type: DataTypes.STRING, allowNull: false, unique: true },
  idempotencyKey: { type: DataTypes.STRING, allowNull: false, unique: true },
  status: { type: DataTypes.ENUM("created", "initiation_pending", "initiated", "customer_action_required", "processing", "verified", "completed", "failed", "cancelled", "expired", "verification_failed", "amount_mismatch"), allowNull: false, defaultValue: "created" },
  currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "LKR" },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  requestAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  verifiedAmount: DataTypes.DECIMAL(12, 2),
  paymentMethod: DataTypes.STRING,
  providerStatusCode: DataTypes.STRING,
  providerStatusMessage: DataTypes.STRING,
  initiatedAt: DataTypes.DATE,
  providerCreatedAt: DataTypes.DATE,
  verifiedAt: DataTypes.DATE,
  completedAt: DataTypes.DATE,
  failedAt: DataTypes.DATE,
  cancelledAt: DataTypes.DATE,
  lastStatusCheckedAt: DataTypes.DATE,
  verificationSource: DataTypes.STRING,
});
