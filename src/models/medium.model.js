import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineMedium = (sequelize) =>
  defineModel(sequelize, "Medium", {
    code: { type: DataTypes.ENUM("sinhala", "english"), unique: true },
    name: DataTypes.STRING,
    locale: DataTypes.STRING,
  });
