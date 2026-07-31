import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineOrderItem = (sequelize) =>
  defineModel(sequelize, "OrderItem", {
    orderId: DataTypes.UUID,
    productId: DataTypes.UUID,
    lessonId: DataTypes.UUID,
    name: DataTypes.STRING,
    unitPrice: DataTypes.DECIMAL(12, 2),
  });
