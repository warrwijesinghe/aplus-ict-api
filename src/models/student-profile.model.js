import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// Keep student-specific information out of the shared user record.
export const defineStudentProfile = (sequelize) =>
  defineModel(sequelize, "StudentProfile", {
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    phone: DataTypes.STRING,
    preferredMedium: DataTypes.ENUM("sinhala", "english"),
  });
