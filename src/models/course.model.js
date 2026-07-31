import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineCourse = (sequelize) =>
  defineModel(sequelize, "Course", {
    categoryId: DataTypes.UUID,
    title: DataTypes.STRING,
    slug: { type: DataTypes.STRING, unique: true },
    code: DataTypes.STRING,
    academicLevel: { type: DataTypes.ENUM("al", "ol"), defaultValue: "al" },
    description: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  });
