import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineLessonSection = (sequelize) =>
  defineModel(sequelize, "LessonSection", {
    lessonId: DataTypes.UUID,
    type: {
      type: DataTypes.ENUM(
        "heading",
        "rich_text",
        "note",
        "video",
        "activity",
        "quiz",
        "image",
        "pdf",
        "download",
        "embed",
        "callout",
      ),
      allowNull: false,
    },
    title: DataTypes.STRING,
    // A lesson can mix open content and premium content. Buying the lesson
    // unlocks only the sections marked as paid.
    accessPolicy: {
      type: DataTypes.ENUM("free", "paid"),
      defaultValue: "free",
    },
    content: DataTypes.TEXT("long"),
    youtubeUrl: DataTypes.STRING,
    resourceId: DataTypes.UUID,
    config: DataTypes.JSON,
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
  });
