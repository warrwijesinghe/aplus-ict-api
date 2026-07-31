import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineLessonProgress = (sequelize) =>
  defineModel(sequelize, "LessonProgress", {
    userId: DataTypes.UUID,
    lessonId: DataTypes.UUID,
    status: {
      type: DataTypes.ENUM("not_started", "in_progress", "completed"),
      defaultValue: "not_started",
    },
    percentage: { type: DataTypes.INTEGER, defaultValue: 0 },
    lastPosition: DataTypes.STRING,
    completedAt: DataTypes.DATE,
  });
