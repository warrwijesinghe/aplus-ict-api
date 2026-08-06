import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineOrderItem = (sequelize) =>
  defineModel(sequelize, "OrderItem", {
    orderId: { type: DataTypes.UUID, allowNull: false },
    productId: { type: DataTypes.UUID, allowNull: false },
    lessonId: DataTypes.UUID,
    courseId: DataTypes.UUID,
    courseTrackId: DataTypes.UUID,
    name: DataTypes.STRING,
    productNameSnapshot: DataTypes.STRING,
    productTypeSnapshot: DataTypes.STRING,
    currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "LKR" },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  });
