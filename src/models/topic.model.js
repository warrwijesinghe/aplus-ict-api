import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineTopic = (sequelize) =>
  defineModel(sequelize, "Topic", {
    lessonId: { type: DataTypes.UUID, allowNull: false },
    slug: DataTypes.STRING,
    title: DataTypes.STRING,
    titleEn: DataTypes.STRING,
    titleSi: DataTypes.STRING,
    descriptionEn: DataTypes.TEXT,
    descriptionSi: DataTypes.TEXT,
    status: { type: DataTypes.ENUM("draft", "published", "archived"), defaultValue: "draft" },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
    availableFrom: DataTypes.DATE,
    availableUntil: DataTypes.DATE,
  });
