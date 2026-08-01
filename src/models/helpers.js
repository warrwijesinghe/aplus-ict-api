import { DataTypes } from "sequelize";

// All tables use UUID keys, allowing feature modules to reference records safely.
export const id = {
  type: DataTypes.UUID,
  defaultValue: DataTypes.UUIDV4,
  primaryKey: true,
};
// Migrations intentionally use camelCase columns (for example `passwordHash` and
// `createdAt`). Table names remain snake_case, so map them explicitly here instead
// of enabling Sequelize's `underscored` option, which changes column names too.
const tableNames = Object.freeze({
  User: "users",
  RefreshToken: "refresh_tokens",
  Category: "categories",
  AcademicLevel: "academic_levels",
  Course: "courses",
  Medium: "media",
  CourseTrack: "course_tracks",
  Lesson: "lessons",
  Topic: "topics",
  LessonSection: "lesson_sections",
  Enrolment: "enrolments",
  Entitlement: "entitlements",
  LessonProgress: "lesson_progresses",
  ContentProgress: "content_progresses",
  Resource: "resources",
  DownloadableResource: "downloadable_resources",
  Product: "products",
  Order: "orders",
  OrderItem: "order_items",
  Payment: "payments",
  GoogleIdentity: "google_identities",
  StudentProfile: "student_profiles",
  Role: "roles",
  Permission: "permissions",
  UserRole: "user_roles",
  RolePermission: "role_permissions",
});

export const defineModel = (sequelize, name, fields, options = {}) =>
  sequelize.define(
    name,
    { id, ...fields },
    { tableName: tableNames[name], ...options },
  );
