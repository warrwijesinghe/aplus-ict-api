import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const PREREQUISITE_TYPES = Object.freeze(["complete_previous_activity", "pass_previous_quiz", "complete_previous_topic", "require_premium_entitlement", "available_after_date", "teacher_approval", "complete_specific_activity", "pass_specific_quiz", "complete_specific_topic"]);
export const defineActivityPrerequisite = (sequelize) => defineModel(sequelize, "ActivityPrerequisite", {
  activityId: { type: DataTypes.UUID, allowNull: false },
  prerequisiteType: { type: DataTypes.ENUM(...PREREQUISITE_TYPES), allowNull: false },
  requiredActivityId: DataTypes.UUID,
  requiredTopicId: DataTypes.UUID,
  requiredQuizId: DataTypes.UUID,
  requiredEntitlementType: DataTypes.STRING,
  availableAfter: DataTypes.DATE,
  teacherApprovalRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  createdByUserId: { type: DataTypes.UUID, allowNull: false },
  updatedByUserId: DataTypes.UUID,
});

export const defineTeacherActivityApproval = (sequelize) => defineModel(sequelize, "TeacherActivityApproval", {
  userId: { type: DataTypes.UUID, allowNull: false, unique: "teacher_activity_approval_student_activity" }, activityId: { type: DataTypes.UUID, allowNull: false, unique: "teacher_activity_approval_student_activity" },
  approvedByUserId: { type: DataTypes.UUID, allowNull: false }, approvedAt: { type: DataTypes.DATE, allowNull: false }, revokedAt: DataTypes.DATE, comment: DataTypes.TEXT,
});

export const defineTeacherGradeComment = (sequelize) => defineModel(sequelize, "TeacherGradeComment", {
  userId: { type: DataTypes.UUID, allowNull: false }, courseTrackId: { type: DataTypes.UUID, allowNull: false }, teacherId: { type: DataTypes.UUID, allowNull: false },
  comment: { type: DataTypes.TEXT, allowNull: false }, visibility: { type: DataTypes.ENUM("student_visible", "teacher_private"), allowNull: false, defaultValue: "student_visible" },
});
