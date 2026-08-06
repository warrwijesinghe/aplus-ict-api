import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineEntitlement = (sequelize) =>
  defineModel(sequelize, "Entitlement", {
    userId: { type: DataTypes.UUID, allowNull: false },
    entitlementType: { type: DataTypes.STRING, allowNull: false, defaultValue: "lesson_premium_access" },
    courseId: DataTypes.UUID,
    courseTrackId: DataTypes.UUID,
    lessonId: DataTypes.UUID,
    activityId: DataTypes.UUID,
    orderId: DataTypes.UUID,
    status: {
      type: DataTypes.ENUM("active", "expired", "revoked", "pending"),
      defaultValue: "active",
    },
    sourceType: { type: DataTypes.ENUM("order", "admin", "migration", "promotion"), defaultValue: "order" },
    sourceId: DataTypes.UUID,
    startsAt: DataTypes.DATE,
    endsAt: DataTypes.DATE,
    grantedBy: DataTypes.UUID,
    revokedBy: DataTypes.UUID,
    revokedAt: DataTypes.DATE,
  });
