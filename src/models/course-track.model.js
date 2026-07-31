import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineCourseTrack = (sequelize) =>
  defineModel(sequelize, "CourseTrack", {
    courseId: DataTypes.UUID,
    mediumId: DataTypes.UUID,
    title: DataTypes.STRING,
    slug: { type: DataTypes.STRING, unique: true },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      defaultValue: "draft",
    },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  });
