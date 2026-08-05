"use strict";

module.exports = {
  async up(q) {
    // Compatibility `users.role` predates normalized roles. Backfill every staff
    // account that lacks a role join so authorization never produces an empty UI.
    await q.sequelize.query(`
      INSERT INTO user_roles (id, userId, roleId, createdAt, updatedAt)
      SELECT UUID(), u.id, r.id, NOW(), NOW()
      FROM users u JOIN roles r ON r.code = u.role AND r.isActive = 1
      LEFT JOIN user_roles ur ON ur.userId = u.id AND ur.roleId = r.id
      WHERE u.role IN ('admin', 'super_admin', 'teacher', 'content_editor', 'student') AND ur.id IS NULL
    `);
  },
  async down() {},
};
