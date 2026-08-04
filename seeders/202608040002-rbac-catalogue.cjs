"use strict";
const { randomUUID } = require("crypto");
module.exports = {
  async up(q) {
    const { systemRoles, permissionCatalogue, defaultRolePermissions } = await import("../src/security/permissions.js");
    const now = new Date();
    for (const role of systemRoles) await q.sequelize.query("INSERT INTO roles (id, code, name, description, isSystemRole, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, true, true, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), isSystemRole=true", { replacements: [randomUUID(), role.code, role.name, role.description, now, now] });
    for (const permission of permissionCatalogue) await q.sequelize.query("INSERT INTO permissions (id, code, name, description, module, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), module=VALUES(module)", { replacements: [randomUUID(), permission.code, permission.name, permission.description, permission.module, now, now] });
    for (const [role, codes] of Object.entries(defaultRolePermissions)) for (const code of codes) await q.sequelize.query("INSERT INTO role_permissions (id, roleId, permissionId, createdAt, updatedAt) SELECT ?, r.id, p.id, ?, ? FROM roles r JOIN permissions p WHERE r.code = ? AND p.code = ? AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.roleId=r.id AND rp.permissionId=p.id)", { replacements: [randomUUID(), now, now, role, code] });
  },
  async down() {},
};
