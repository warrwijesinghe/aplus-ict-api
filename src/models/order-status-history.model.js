import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineOrderStatusHistory = (sequelize) => defineModel(sequelize, "OrderStatusHistory", {
  orderId: { type: DataTypes.UUID, allowNull: false },
  fromStatus: DataTypes.STRING,
  toStatus: { type: DataTypes.STRING, allowNull: false },
  paymentStatus: DataTypes.STRING,
  actorUserId: DataTypes.UUID,
  reason: DataTypes.STRING,
});
