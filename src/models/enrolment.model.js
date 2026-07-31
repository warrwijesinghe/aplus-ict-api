import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineEnrolment = (sequelize) =>
  defineModel(sequelize, "Enrolment", {
    userId: DataTypes.UUID,
    courseId: DataTypes.UUID,
    status: {
      type: DataTypes.ENUM("active", "completed", "revoked"),
      defaultValue: "active",
    },
    source: {
      type: DataTypes.ENUM("free", "purchase", "manual"),
      defaultValue: "free",
    },
  });
