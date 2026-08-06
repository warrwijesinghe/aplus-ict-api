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
  ResourceLink: "resource_links",
  QuestionCategory: "question_categories",
  Question: "questions",
  QuestionOption: "question_options",
  QuestionAcceptedAnswer: "question_accepted_answers",
  QuestionNumericAnswer: "question_numeric_answers",
  QuestionMatchingPair: "question_matching_pairs",
  QuestionOrderingItem: "question_ordering_items",
  QuestionEssayConfig: "question_essay_configs",
  QuestionTag: "question_tags",
  QuestionTagAssignment: "question_tag_assignments",
  DownloadableResource: "downloadable_resources",
  Product: "products",
  ProductEntitlementRule: "product_entitlement_rules",
  Order: "orders",
  OrderItem: "order_items",
  OrderStatusHistory: "order_status_history",
  Payment: "payments",
  PaymentTransaction: "payment_transactions",
  PaymentProviderEvent: "payment_provider_events",
  GoogleIdentity: "google_identities",
  StudentProfile: "student_profiles",
  StudentCourseState: "student_course_states",
  StudentLearningHistory: "student_learning_history",
  Role: "roles",
  Permission: "permissions",
  UserRole: "user_roles",
  RolePermission: "role_permissions",
  EducatorAssignment: "educator_assignments",
  AuditLog: "audit_logs",
  QuizAttempt: "quiz_attempts",
  QuizAttemptQuestion: "quiz_attempt_questions",
  QuizAnswer: "quiz_answers",
  QuizAnswerOption: "quiz_answer_options",
  QuizAnswerMatchingItem: "quiz_answer_matching_items",
  QuizAnswerOrderingItem: "quiz_answer_ordering_items",
  QuizGrade: "quiz_grades",
});

export const defineModel = (sequelize, name, fields, options = {}) =>
  sequelize.define(
    name,
    { id, ...fields },
    { tableName: tableNames[name], ...options },
  );
