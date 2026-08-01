import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineAcademicLevel = (sequelize) =>
  defineModel(sequelize, "AcademicLevel", {
    code: { type: DataTypes.STRING, unique: true },
    nameEn: DataTypes.STRING,
    nameSi: DataTypes.STRING,
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  });
