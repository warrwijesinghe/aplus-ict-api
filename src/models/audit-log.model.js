import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineAuditLog = (sequelize) => defineModel(sequelize, "AuditLog", {
  actorUserId: { type: DataTypes.UUID, allowNull: false }, action: { type: DataTypes.STRING, allowNull: false }, targetType: { type: DataTypes.STRING, allowNull: false }, targetId: DataTypes.UUID,
  metadata: DataTypes.JSON, ipAddress: DataTypes.STRING, userAgent: DataTypes.STRING,
});
