import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const definePhoneChallenge = (sequelize) => defineModel(sequelize, "PhoneChallenge", {
  phoneNumber: { type: DataTypes.STRING(20), allowNull: false },
  purpose: { type: DataTypes.STRING(20), allowNull: false },
  challengeId: { type: DataTypes.UUID, unique: true },
  codeHash: DataTypes.STRING(64),
  verificationHash: DataTypes.STRING(64),
  expiresAt: DataTypes.DATE,
  verifiedAt: DataTypes.DATE,
  consumedAt: DataTypes.DATE,
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  sentAt: DataTypes.DATE,
  windowStartedAt: DataTypes.DATE,
  sendCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { indexes: [{ unique: true, fields: ["phoneNumber", "purpose"] }] });
