import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineResource = (sequelize) =>
  defineModel(sequelize, "Resource", {
    ownerUserId: DataTypes.UUID,
    category: {
      type: DataTypes.ENUM("image", "pdf", "document"),
      allowNull: false,
    },
    originalFilename: DataTypes.STRING,
    displayName: DataTypes.STRING,
    mimeType: DataTypes.STRING,
    sizeBytes: DataTypes.BIGINT,
    storageProvider: { type: DataTypes.STRING, defaultValue: "local" },
    storageKey: { type: DataTypes.STRING, unique: true },
    visibility: {
      type: DataTypes.ENUM("public", "authenticated", "private"),
      defaultValue: "private",
    },
    status: {
      type: DataTypes.ENUM("ready", "archived"),
      defaultValue: "ready",
    },
  });
