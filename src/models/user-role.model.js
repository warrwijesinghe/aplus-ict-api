import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

// Join table permits a staff member to hold several roles without duplicating a user.
export const defineUserRole = (sequelize) =>
  defineModel(sequelize, "UserRole", {
    userId: { type: DataTypes.UUID, allowNull: false },
    roleId: { type: DataTypes.UUID, allowNull: false },
  });
