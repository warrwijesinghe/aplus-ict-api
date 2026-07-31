import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const defineRolePermission = (sequelize) =>
  defineModel(sequelize, "RolePermission", {
    roleId: { type: DataTypes.UUID, allowNull: false },
    permissionId: { type: DataTypes.UUID, allowNull: false },
  });
