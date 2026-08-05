import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";
export const defineResource = (sequelize) =>
  defineModel(sequelize, "Resource", {
    ownerUserId: DataTypes.UUID,
    category: { type: DataTypes.STRING, allowNull: false },
    originalFilename: DataTypes.STRING,
    storedName: DataTypes.STRING,
    displayName: DataTypes.STRING,
    description: DataTypes.TEXT,
    mimeType: DataTypes.STRING,
    extension: DataTypes.STRING(12),
    sizeBytes: DataTypes.BIGINT,
    checksum: DataTypes.STRING(64),
    storageProvider: { type: DataTypes.STRING, defaultValue: "local" },
    storageKey: { type: DataTypes.STRING, unique: true },
    visibility: { type: DataTypes.STRING, defaultValue: "private" },
    accessPolicy: { type: DataTypes.STRING, defaultValue: "admin_only" },
    status: { type: DataTypes.STRING, defaultValue: "active" },
    uploadedByUserId: DataTypes.UUID,
    replacedByResourceId: DataTypes.UUID,
    archivedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
    imageWidth: DataTypes.INTEGER,
    imageHeight: DataTypes.INTEGER,
  });
