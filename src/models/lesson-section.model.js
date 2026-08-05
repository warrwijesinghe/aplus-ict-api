import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineLessonSection = (sequelize) =>
  defineModel(sequelize, "LessonSection", {
    lessonId: DataTypes.UUID,
    topicId: DataTypes.UUID,
    type: {
      type: DataTypes.ENUM(
        "label",
        "page",
        "rich_text",
        "video",
        "quiz",
        "image",
        "pdf",
        "download",
        "embed",
        "file",
        "external_link",
        "practical_activity",
        "assignment",
      ),
      allowNull: false,
    },
    title: DataTypes.STRING,
    titleEn: DataTypes.STRING,
    titleSi: DataTypes.STRING,
    descriptionEn: DataTypes.TEXT,
    descriptionSi: DataTypes.TEXT,
    // A lesson can mix open content and premium content. Buying the lesson
    // unlocks only the sections marked as paid.
    accessPolicy: {
      type: DataTypes.ENUM("free", "premium", "paid", "preview"),
      defaultValue: "free",
    },
    content: DataTypes.TEXT("long"),
    youtubeUrl: DataTypes.STRING,
    externalUrl: DataTypes.STRING,
    instructions: DataTypes.TEXT,
    resourceId: DataTypes.UUID,
    config: DataTypes.JSON,
    completionMode: { type: DataTypes.ENUM("none", "view", "manual", "submit", "pass"), defaultValue: "none" },
    estimatedMinutes: DataTypes.INTEGER,
    maxScore: DataTypes.DECIMAL(10, 2),
    passingScore: DataTypes.DECIMAL(10, 2),
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: { type: DataTypes.ENUM("draft", "published", "archived"), defaultValue: "published" },
    availableFrom: DataTypes.DATE,
    availableUntil: DataTypes.DATE,
  });
