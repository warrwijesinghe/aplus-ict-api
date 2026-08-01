import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineCourse = (sequelize) =>
  defineModel(sequelize, "Course", {
    categoryId: DataTypes.UUID,
    academicLevelId: DataTypes.UUID,
    title: DataTypes.STRING,
    titleEn: DataTypes.STRING,
    titleSi: DataTypes.STRING,
    slug: { type: DataTypes.STRING, unique: true },
    code: DataTypes.STRING,
    // The academic area groups grade-level records without introducing a
    // parallel catalogue or separate LMS implementation.
    courseGroup: DataTypes.STRING,
    academicLevel: { type: DataTypes.ENUM("al", "ol"), defaultValue: "al" },
    description: DataTypes.TEXT,
    shortDescriptionEn: DataTypes.TEXT,
    shortDescriptionSi: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
    isPublic: { type: DataTypes.BOOLEAN, defaultValue: false },
    publishedAt: DataTypes.DATE,
  });
