import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineRole = (sequelize) =>
  defineModel(sequelize, "Role", {
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    isSystemRole: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  });
