import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineProduct = (sequelize) =>
  defineModel(sequelize, "Product", {
    lessonId: DataTypes.UUID,
    name: DataTypes.STRING,
    slug: { type: DataTypes.STRING, unique: true },
    price: DataTypes.DECIMAL(12, 2),
    currency: { type: DataTypes.CHAR(3), defaultValue: "LKR" },
    status: {
      type: DataTypes.ENUM("draft", "active", "inactive"),
      defaultValue: "draft",
    },
  });
