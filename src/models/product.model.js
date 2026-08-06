import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineProduct = (sequelize) =>
  defineModel(sequelize, "Product", {
    productType: { type: DataTypes.ENUM("lesson_exam_success_pack", "course_exam_success_pack", "bundle", "printed_tute"), allowNull: false, defaultValue: "lesson_exam_success_pack" },
    lessonId: DataTypes.UUID,
    courseId: DataTypes.UUID,
    courseTrackId: DataTypes.UUID,
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, unique: true },
    shortDescription: DataTypes.TEXT,
    description: DataTypes.TEXT,
    price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    compareAtPrice: DataTypes.DECIMAL(12, 2),
    currency: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "LKR" },
    status: {
      type: DataTypes.ENUM("draft", "published", "unpublished", "archived", "active", "inactive"),
      defaultValue: "draft",
    },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
    salesStartAt: DataTypes.DATE,
    salesEndAt: DataTypes.DATE,
    entitlementDurationDays: DataTypes.INTEGER,
    createdByUserId: DataTypes.UUID,
    updatedByUserId: DataTypes.UUID,
    publishedAt: DataTypes.DATE,
    archivedAt: DataTypes.DATE,
  });
