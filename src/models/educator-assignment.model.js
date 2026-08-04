import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineEducatorAssignment = (sequelize) => defineModel(sequelize, "EducatorAssignment", {
  userId: { type: DataTypes.UUID, allowNull: false }, courseId: DataTypes.UUID, courseTrackId: DataTypes.UUID,
  assignmentRole: { type: DataTypes.ENUM("teacher", "content_editor"), allowNull: false },
  canManageContent: { type: DataTypes.BOOLEAN, defaultValue: false }, canManageQuestions: { type: DataTypes.BOOLEAN, defaultValue: false },
  canManageQuizzes: { type: DataTypes.BOOLEAN, defaultValue: false }, canGradeAssignments: { type: DataTypes.BOOLEAN, defaultValue: false },
  canViewStudents: { type: DataTypes.BOOLEAN, defaultValue: false }, status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
  assignedByUserId: { type: DataTypes.UUID, allowNull: false }, assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});
