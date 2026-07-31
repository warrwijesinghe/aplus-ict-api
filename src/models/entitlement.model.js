import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineEntitlement = (sequelize) =>
  defineModel(sequelize, "Entitlement", {
    userId: DataTypes.UUID,
    lessonId: DataTypes.UUID,
    orderId: DataTypes.UUID,
    status: {
      type: DataTypes.ENUM("active", "revoked"),
      defaultValue: "active",
    },
    startsAt: DataTypes.DATE,
    endsAt: DataTypes.DATE,
  });
