import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineResourceLink = (sequelize) => defineModel(sequelize, "ResourceLink", {
  resourceId: { type: DataTypes.UUID, allowNull: false },
  entityType: { type: DataTypes.STRING, allowNull: false },
  entityId: { type: DataTypes.UUID, allowNull: false },
  purpose: { type: DataTypes.STRING, allowNull: false, defaultValue: "attachment" },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  createdByUserId: DataTypes.UUID,
});
