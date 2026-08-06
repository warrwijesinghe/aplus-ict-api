import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const LEARNING_EVENT_TYPES = Object.freeze([
  "course_enrolled", "course_opened", "lesson_opened", "activity_opened",
  "activity_completed", "quiz_started", "quiz_submitted", "quiz_passed",
]);

export const defineStudentLearningHistory = (sequelize) => defineModel(sequelize, "StudentLearningHistory", {
  userId: { type: DataTypes.UUID, allowNull: false },
  courseTrackId: { type: DataTypes.UUID, allowNull: false },
  lessonId: DataTypes.UUID,
  topicId: DataTypes.UUID,
  activityId: DataTypes.UUID,
  quizId: DataTypes.UUID,
  quizAttemptId: DataTypes.UUID,
  eventType: { type: DataTypes.ENUM(...LEARNING_EVENT_TYPES), allowNull: false },
  occurredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  // Only controlled identifiers / operational flags belong here; never answer or content payloads.
  metadata: DataTypes.JSON,
});
