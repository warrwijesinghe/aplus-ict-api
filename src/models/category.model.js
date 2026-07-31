import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineCategory = (sequelize) =>
  defineModel(sequelize, "Category", {
    name: DataTypes.STRING,
    slug: { type: DataTypes.STRING, unique: true },
    description: DataTypes.TEXT,
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  });
