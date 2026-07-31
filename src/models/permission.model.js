import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const definePermission = (sequelize) =>
  defineModel(sequelize, "Permission", {
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
  });
