import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineActivityCompletion = (sequelize) => defineModel(sequelize, "ActivityCompletion", {
  userId: { type: DataTypes.UUID, allowNull: false, unique: "activity_completion_student_activity" },
  courseTrackId: { type: DataTypes.UUID, allowNull: false },
  lessonId: { type: DataTypes.UUID, allowNull: false },
  topicId: DataTypes.UUID,
  activityId: { type: DataTypes.UUID, allowNull: false, unique: "activity_completion_student_activity" },
  completionMode: { type: DataTypes.ENUM("none", "view", "manual", "submit", "pass"), allowNull: false },
  status: { type: DataTypes.ENUM("not_started", "in_progress", "completed", "pending", "failed"), allowNull: false, defaultValue: "not_started" },
  completedAt: DataTypes.DATE,
  source: DataTypes.STRING,
  sourceReferenceId: DataTypes.UUID,
});
