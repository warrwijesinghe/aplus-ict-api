import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineOrder = (sequelize) =>
  defineModel(sequelize, "Order", {
    userId: DataTypes.UUID,
    orderNumber: { type: DataTypes.STRING, unique: true },
    status: {
      type: DataTypes.ENUM("awaiting_payment", "paid", "cancelled"),
      defaultValue: "awaiting_payment",
    },
    total: DataTypes.DECIMAL(12, 2),
    currency: { type: DataTypes.CHAR(3), defaultValue: "LKR" },
  });
