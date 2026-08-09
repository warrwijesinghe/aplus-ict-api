import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// Keep student-specific information out of the shared user record.
export const defineStudentProfile = (sequelize) =>
  defineModel(sequelize, "StudentProfile", {
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    fullName: DataTypes.STRING,
    dateOfBirth: DataTypes.DATEONLY,
    address: DataTypes.TEXT,
    city: DataTypes.STRING,
    mobileNumber: DataTypes.STRING,
    whatsAppNumber: DataTypes.STRING,
    gender: DataTypes.STRING,
    examYear: DataTypes.INTEGER,
    schoolName: DataTypes.STRING,
    district: DataTypes.STRING,
    // This controls the language used for student communications only.
    // It never constrains the mediums a student can browse or enrol in.
    preferredMedium: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "sinhala" },
    town: DataTypes.STRING,
    guardianContactNumber: DataTypes.STRING,
    referralSource: DataTypes.STRING,
    profileStatus: { type: DataTypes.ENUM("incomplete", "complete"), allowNull: false, defaultValue: "incomplete" },
    completedAt: DataTypes.DATE,
  });
