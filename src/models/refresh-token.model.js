import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineRefreshToken = (sequelize) =>
  defineModel(sequelize, "RefreshToken", {
    userId: DataTypes.UUID,
    tokenHash: { type: DataTypes.STRING, unique: true },
    expiresAt: DataTypes.DATE,
    revokedAt: DataTypes.DATE,
  });
