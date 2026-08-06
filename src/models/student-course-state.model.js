import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// The durable continuation pointer for a student's enrolled Medium.
export const defineStudentCourseState = (sequelize) => defineModel(sequelize, "StudentCourseState", {
  userId: { type: DataTypes.UUID, allowNull: false },
  courseTrackId: { type: DataTypes.UUID, allowNull: false },
  lastLessonId: DataTypes.UUID,
  lastTopicId: DataTypes.UUID,
  lastActivityId: DataTypes.UUID,
  lastAccessedAt: DataTypes.DATE,
});
