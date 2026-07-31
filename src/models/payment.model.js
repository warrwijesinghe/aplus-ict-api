import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const definePayment = (sequelize) =>
  defineModel(sequelize, "Payment", {
    orderId: DataTypes.UUID,
    method: {
      type: DataTypes.ENUM("bank_transfer", "manual"),
      defaultValue: "bank_transfer",
    },
    status: {
      type: DataTypes.ENUM("submitted", "confirmed", "rejected"),
      defaultValue: "submitted",
    },
    amount: DataTypes.DECIMAL(12, 2),
    reference: DataTypes.STRING,
    paymentSlipResourceId: DataTypes.UUID,
    confirmedBy: DataTypes.UUID,
    confirmedAt: DataTypes.DATE,
  });
