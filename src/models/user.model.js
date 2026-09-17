import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineUser = (sequelize) =>
  defineModel(sequelize, "User", {
    // Phone-first students do not need an email address; staff may retain one.
    email: { type: DataTypes.STRING, unique: true, allowNull: true },
    phoneNumber: { type: DataTypes.STRING(20), unique: true, allowNull: true },
    phoneVerifiedAt: DataTypes.DATE,
    name: DataTypes.STRING,
    passwordHash: DataTypes.STRING,
    // Compatibility value and primary-role cache. Normalized roles remain authoritative.
    role: { type: DataTypes.STRING, defaultValue: "student" },
    status: {
      type: DataTypes.ENUM("active", "disabled"),
      defaultValue: "active",
    },
  });
