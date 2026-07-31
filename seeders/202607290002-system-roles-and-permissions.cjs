"use strict";

const { randomUUID } = require("crypto");

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const roles = [
      { id: randomUUID(), code: "student", name: "Student" },
      { id: randomUUID(), code: "admin", name: "Administrator" },
    ];
    const permissions = [
      "catalogue.manage",
      "students.read",
      "learning.read",
      "orders.manage",
      "payments.confirm",
      "resources.manage",
    ].map((code) => ({ id: randomUUID(), code, name: code }));

    await queryInterface.bulkInsert(
      "roles",
      roles.map((role) => ({ ...role, createdAt: now, updatedAt: now })),
    );
    await queryInterface.bulkInsert(
      "permissions",
      permissions.map((permission) => ({
        ...permission,
        createdAt: now,
        updatedAt: now,
      })),
    );
    const admin = roles.find((role) => role.code === "admin");
    await queryInterface.bulkInsert(
      "role_permissions",
      permissions.map((permission) => ({
        id: randomUUID(),
        roleId: admin.id,
        permissionId: permission.id,
        createdAt: now,
        updatedAt: now,
      })),
    );
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete("role_permissions", null, {});
    await queryInterface.bulkDelete("permissions", null, {});
    await queryInterface.bulkDelete("roles", null, {});
  },
};
