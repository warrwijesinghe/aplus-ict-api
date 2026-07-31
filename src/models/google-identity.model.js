import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// External identities are separate from users so future providers do not alter user records.
export const defineGoogleIdentity = (sequelize) =>
  defineModel(sequelize, "GoogleIdentity", {
    userId: { type: DataTypes.UUID, allowNull: false },
    subject: { type: DataTypes.STRING, allowNull: false, unique: true },
    emailAtLinkTime: { type: DataTypes.STRING, allowNull: false },
  });
