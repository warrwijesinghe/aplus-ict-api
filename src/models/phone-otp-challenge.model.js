import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const definePhoneOtpChallenge = (sequelize) =>
  defineModel(sequelize, "PhoneOtpChallenge", {
    phoneNumber: { type: DataTypes.STRING(20), allowNull: false },
    purpose: { type: DataTypes.ENUM("register", "reset"), allowNull: false },
    codeHash: { type: DataTypes.STRING(64), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    resendAvailableAt: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    verifiedAt: DataTypes.DATE,
    consumedAt: DataTypes.DATE,
  });
