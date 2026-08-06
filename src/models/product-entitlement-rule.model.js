import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineProductEntitlementRule = (sequelize) => defineModel(sequelize, "ProductEntitlementRule", {
  productId: { type: DataTypes.UUID, allowNull: false },
  entitlementType: { type: DataTypes.ENUM("lesson_premium_access"), allowNull: false, defaultValue: "lesson_premium_access" },
  courseId: { type: DataTypes.UUID, allowNull: false },
  courseTrackId: { type: DataTypes.UUID, allowNull: false },
  lessonId: DataTypes.UUID,
  activityId: DataTypes.UUID,
  durationDays: DataTypes.INTEGER,
});
