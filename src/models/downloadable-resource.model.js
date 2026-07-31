import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// A downloadable resource is the public catalogue entry for one uploaded file.
// The existing Resource model remains responsible for storage metadata and file bytes.
export const defineDownloadableResource = (sequelize) =>
  defineModel(sequelize, "DownloadableResource", {
    resourceId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    // Keep this as text instead of an ENUM so an admin can introduce a new
    // resource type later (for example, revision_booklet) without a migration.
    resourceType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    academicLevel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    medium: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "all",
    },
    accessPolicy: {
      type: DataTypes.ENUM("free", "paid"),
      allowNull: false,
      defaultValue: "free",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  });
