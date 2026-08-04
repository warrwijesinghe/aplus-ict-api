"use strict";
const { randomUUID } = require("crypto");
const roles = [
  ["student", "Student", "Learner self-service access"], ["teacher", "Teacher", "Course-scoped teaching access"],
  ["content_editor", "Content editor", "Course-scoped content access"], ["admin", "Administrator", "Operational administration"],
  ["super_admin", "Super administrator", "Platform ownership and security administration"],
];
const permissions = ["courses.read","courses.create","courses.update","courses.publish","courses.archive","tracks.read","tracks.create","tracks.update","tracks.publish","lessons.read","lessons.create","lessons.update","lessons.publish","lessons.reorder","topics.read","topics.create","topics.update","topics.reorder","activities.read","activities.create","activities.update","activities.publish","activities.reorder","resources.read","resources.create","resources.update","resources.delete","questions.read","questions.create","questions.update","questions.publish","quizzes.read","quizzes.create","quizzes.update","quizzes.publish","students.read","students.read_contact_details","students.update","enrollments.read","enrollments.manage","progress.read","grades.read","grades.manage","assignments.read","assignments.grade","orders.read","payments.read","payments.confirm","payments.reject","educators.read","educators.assign","roles.read","roles.manage","settings.read","settings.manage","audit.read"];
const teacher = ["courses.read","tracks.read","lessons.read","lessons.update","topics.read","topics.update","activities.read","activities.update","resources.read","resources.create","questions.read","questions.create","questions.update","quizzes.read","quizzes.create","quizzes.update","students.read","enrollments.read","progress.read","grades.read","grades.manage","assignments.read","assignments.grade"];
const editor = ["courses.read","tracks.read","lessons.read","lessons.create","lessons.update","topics.read","topics.create","topics.update","activities.read","activities.create","activities.update","resources.read","resources.create","resources.update","questions.read","questions.create","questions.update","quizzes.read","quizzes.create","quizzes.update"];
const mappings = { student: ["courses.read","tracks.read","lessons.read","progress.read"], teacher, content_editor: editor, admin: permissions.filter((p) => !["roles.manage","settings.manage","audit.read"].includes(p)), super_admin: permissions };

module.exports = {
  async up(q, S) {
    const hasColumn = async (table, column) => Object.hasOwn(await q.describeTable(table), column);
    const addColumn = async (table, column, definition) => { if (!(await hasColumn(table, column))) await q.addColumn(table, column, definition); };
    const ensureIndex = async (table, fields, name) => { if (!(await q.showIndex(table)).some((index) => index.name === name)) await q.addIndex(table, fields, { name }); };
    const ensureForeignKey = async (table, field, target, name) => { if (!(await q.getForeignKeyReferencesForTable(table)).some((key) => key.columnName === field)) await q.addConstraint(table, { name, fields: [field], type: "foreign key", references: { table: target, field: "id" }, onUpdate: "cascade", onDelete: "restrict" }); };
    const tables = await q.showAllTables();
    await q.changeColumn("users", "role", { type: S.STRING, allowNull: false, defaultValue: "student" });
    await addColumn("roles", "description", { type: S.TEXT, allowNull: true });
    await addColumn("roles", "isSystemRole", { type: S.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumn("roles", "isActive", { type: S.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumn("permissions", "description", { type: S.TEXT, allowNull: true });
    await addColumn("permissions", "module", { type: S.STRING, allowNull: false, defaultValue: "general" });
    const createdAssignments = !tables.includes("educator_assignments");
    if (createdAssignments) await q.createTable("educator_assignments", {
      id: { type: S.UUID, primaryKey: true, allowNull: false }, userId: { type: S.UUID, allowNull: false }, courseId: S.UUID, courseTrackId: S.UUID,
      assignmentRole: { type: S.ENUM("teacher", "content_editor"), allowNull: false }, canManageContent: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      canManageQuestions: { type: S.BOOLEAN, allowNull: false, defaultValue: false }, canManageQuizzes: { type: S.BOOLEAN, allowNull: false, defaultValue: false }, canGradeAssignments: { type: S.BOOLEAN, allowNull: false, defaultValue: false }, canViewStudents: { type: S.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: S.ENUM("active", "inactive"), allowNull: false, defaultValue: "active" }, assignedByUserId: { type: S.UUID, allowNull: false }, assignedAt: { type: S.DATE, allowNull: false, defaultValue: S.literal("CURRENT_TIMESTAMP") }, createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false },
    });
    const createdAuditLogs = !tables.includes("audit_logs");
    if (createdAuditLogs) await q.createTable("audit_logs", {
      id: { type: S.UUID, primaryKey: true, allowNull: false }, actorUserId: { type: S.UUID, allowNull: false }, action: { type: S.STRING, allowNull: false }, targetType: { type: S.STRING, allowNull: false }, targetId: S.UUID, metadata: S.JSON, ipAddress: S.STRING, userAgent: S.STRING, createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false },
    });
    await ensureIndex("educator_assignments", ["userId", "courseTrackId", "status"], "educator_assignments_user_id_course_track_id_status");
    await ensureIndex("educator_assignments", ["courseId", "status"], "educator_assignments_course_id_status");
    for (const [field, target] of [["userId", "users"], ["courseId", "courses"], ["courseTrackId", "course_tracks"], ["assignedByUserId", "users"]]) await ensureForeignKey("educator_assignments", field, target, `educator_assignments_${field}_fk`);
    await ensureIndex("audit_logs", ["actorUserId", "createdAt"], "audit_logs_actor_user_id_created_at");
    await ensureForeignKey("audit_logs", "actorUserId", "users", "audit_logs_actor_user_id_fk");
    const now = new Date();
    for (const [code, name, description] of roles) await q.sequelize.query("INSERT INTO roles (id, code, name, description, isSystemRole, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, true, true, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), isSystemRole = true", { replacements: [randomUUID(), code, name, description, now, now] });
    for (const code of permissions) await q.sequelize.query("INSERT INTO permissions (id, code, name, description, module, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), module = VALUES(module)", { replacements: [randomUUID(), code, code.replace(/\./g, " "), `Allows ${code}`, code.split(".")[0], now, now] });
    // Existing students retain their role; existing administrators are safely promoted to the first system owner role.
    await q.sequelize.query("UPDATE users SET role = 'super_admin' WHERE role = 'admin'");
    for (const code of ["student", "teacher", "content_editor", "admin", "super_admin"]) await q.sequelize.query("INSERT INTO user_roles (id, userId, roleId, createdAt, updatedAt) SELECT UUID(), u.id, r.id, ?, ? FROM users u JOIN roles r ON r.code = CASE WHEN u.role = 'admin' THEN 'super_admin' ELSE u.role END WHERE r.code = ? AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.userId = u.id AND ur.roleId = r.id)", { replacements: [now, now, code] });
    for (const [role, codes] of Object.entries(mappings)) for (const code of codes) await q.sequelize.query("INSERT INTO role_permissions (id, roleId, permissionId, createdAt, updatedAt) SELECT ?, r.id, p.id, ?, ? FROM roles r JOIN permissions p WHERE r.code = ? AND p.code = ? AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.roleId = r.id AND rp.permissionId = p.id)", { replacements: [randomUUID(), now, now, role, code] });
  },
  async down(q) { await q.dropTable("audit_logs"); await q.dropTable("educator_assignments"); await q.removeColumn("permissions", "module"); await q.removeColumn("permissions", "description"); await q.removeColumn("roles", "isActive"); await q.removeColumn("roles", "isSystemRole"); await q.removeColumn("roles", "description"); },
};
