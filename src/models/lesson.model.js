import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineLesson = (sequelize) =>
  defineModel(sequelize, "Lesson", {
    trackId: DataTypes.UUID,
    title: DataTypes.STRING,
    titleEn: DataTypes.STRING,
    titleSi: DataTypes.STRING,
    slug: DataTypes.STRING,
    lessonNumber: DataTypes.INTEGER,
    // Recommended syllabus periods are displayed on the public lesson cards.
    // Keeping the value on the lesson makes it editable from the admin catalogue.
    estimatedPeriods: DataTypes.INTEGER,
    summary: DataTypes.TEXT,
    descriptionEn: DataTypes.TEXT,
    descriptionSi: DataTypes.TEXT,
    // The printed tutorial cover selected for this lesson in the content admin.
    // It is intentionally separate from lesson activity images.
    tutorialImageResourceId: DataTypes.UUID,
    estimatedMinutes: DataTypes.INTEGER,
    accessPolicy: {
      type: DataTypes.ENUM("free", "paid"),
      defaultValue: "free",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
    availableFrom: DataTypes.DATE,
    availableUntil: DataTypes.DATE,
    publishedAt: DataTypes.DATE,
  });
