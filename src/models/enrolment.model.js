import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineEnrolment = (sequelize) =>
  defineModel(sequelize, "Enrolment", {
    userId: { type: DataTypes.UUID, allowNull: false },
    // courseId is retained for existing rows; new enrollments always target a track.
    courseId: DataTypes.UUID,
    courseTrackId: DataTypes.UUID,
    status: {
      type: DataTypes.ENUM("active", "completed", "revoked"),
      defaultValue: "active",
    },
    source: {
      type: DataTypes.ENUM("free", "purchase", "manual"),
      defaultValue: "free",
    },
    enrolledAt: DataTypes.DATE,
    lastAccessedAt: DataTypes.DATE,
  });
