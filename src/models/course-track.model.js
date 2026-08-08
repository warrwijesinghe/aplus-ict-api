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
    availabilityStatus: {
      // Delivery is controlled by the published lifecycle status above. This
      // operational flag only decides whether a published track is available
      // to students.
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
    isPublic: { type: DataTypes.BOOLEAN, defaultValue: false },
    enrolmentOpen: { type: DataTypes.BOOLEAN, defaultValue: false },
    coursePassPercentage: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 50 },
    sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
    publishedAt: DataTypes.DATE,
  });
