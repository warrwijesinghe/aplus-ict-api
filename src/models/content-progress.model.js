import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// Optional section-level progress complements the lesson-level progress summary.
export const defineContentProgress = (sequelize) =>
  defineModel(sequelize, "ContentProgress", {
    userId: { type: DataTypes.UUID, allowNull: false },
    lessonSectionId: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.ENUM("not_started", "in_progress", "completed"),
      defaultValue: "not_started",
    },
    lastPosition: DataTypes.STRING,
    completedAt: DataTypes.DATE,
  });
