import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// Keep student-specific information out of the shared user record.
export const defineStudentProfile = (sequelize) =>
  defineModel(sequelize, "StudentProfile", {
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    fullName: DataTypes.STRING,
    mobileNumber: DataTypes.STRING,
    whatsAppNumber: DataTypes.STRING,
    examYear: DataTypes.INTEGER,
    schoolName: DataTypes.STRING,
    district: DataTypes.STRING,
    preferredMedium: DataTypes.ENUM("sinhala", "english"),
    town: DataTypes.STRING,
    guardianContactNumber: DataTypes.STRING,
    referralSource: DataTypes.STRING,
    profileStatus: { type: DataTypes.ENUM("incomplete", "complete"), allowNull: false, defaultValue: "incomplete" },
    completedAt: DataTypes.DATE,
  });
