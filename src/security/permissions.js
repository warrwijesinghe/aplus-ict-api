export const PERMISSIONS = Object.freeze({
  COURSES_READ: "courses.read", COURSES_CREATE: "courses.create", COURSES_UPDATE: "courses.update", COURSES_PUBLISH: "courses.publish", COURSES_ARCHIVE: "courses.archive",
  TRACKS_READ: "tracks.read", TRACKS_CREATE: "tracks.create", TRACKS_UPDATE: "tracks.update", TRACKS_PUBLISH: "tracks.publish",
  LESSONS_READ: "lessons.read", LESSONS_CREATE: "lessons.create", LESSONS_UPDATE: "lessons.update", LESSONS_PUBLISH: "lessons.publish", LESSONS_REORDER: "lessons.reorder",
  TOPICS_READ: "topics.read", TOPICS_CREATE: "topics.create", TOPICS_UPDATE: "topics.update", TOPICS_REORDER: "topics.reorder",
  ACTIVITIES_READ: "activities.read", ACTIVITIES_CREATE: "activities.create", ACTIVITIES_UPDATE: "activities.update", ACTIVITIES_PUBLISH: "activities.publish", ACTIVITIES_REORDER: "activities.reorder",
  RESOURCES_READ: "resources.read", RESOURCES_CREATE: "resources.create", RESOURCES_UPDATE: "resources.update", RESOURCES_DELETE: "resources.delete",
  QUESTIONS_READ: "questions.read", QUESTIONS_CREATE: "questions.create", QUESTIONS_UPDATE: "questions.update", QUESTIONS_PUBLISH: "questions.publish",
  QUIZZES_READ: "quizzes.read", QUIZZES_CREATE: "quizzes.create", QUIZZES_UPDATE: "quizzes.update", QUIZZES_PUBLISH: "quizzes.publish",
  STUDENTS_READ: "students.read", STUDENTS_READ_CONTACT_DETAILS: "students.read_contact_details", STUDENTS_UPDATE: "students.update",
  ENROLLMENTS_READ: "enrollments.read", ENROLLMENTS_MANAGE: "enrollments.manage", PROGRESS_READ: "progress.read", GRADES_READ: "grades.read", GRADES_MANAGE: "grades.manage",
  ASSIGNMENTS_READ: "assignments.read", ASSIGNMENTS_GRADE: "assignments.grade", ORDERS_READ: "orders.read", PAYMENTS_READ: "payments.read", PAYMENTS_CONFIRM: "payments.confirm", PAYMENTS_REJECT: "payments.reject",
  EDUCATORS_READ: "educators.read", EDUCATORS_ASSIGN: "educators.assign", ROLES_READ: "roles.read", ROLES_MANAGE: "roles.manage", SETTINGS_READ: "settings.read", SETTINGS_MANAGE: "settings.manage", AUDIT_READ: "audit.read",
});

export const permissionCatalogue = Object.values(PERMISSIONS).map((code) => {
  const [module] = code.split(".");
  return { code, name: code.replaceAll(".", " "), description: `Allows ${code}`, module };
});

const all = Object.values(PERMISSIONS);
const pick = (...codes) => codes;
export const defaultRolePermissions = Object.freeze({
  student: pick(PERMISSIONS.COURSES_READ, PERMISSIONS.TRACKS_READ, PERMISSIONS.LESSONS_READ, PERMISSIONS.PROGRESS_READ),
  teacher: pick(PERMISSIONS.COURSES_READ, PERMISSIONS.TRACKS_READ, PERMISSIONS.LESSONS_READ, PERMISSIONS.LESSONS_UPDATE, PERMISSIONS.TOPICS_READ, PERMISSIONS.TOPICS_UPDATE, PERMISSIONS.ACTIVITIES_READ, PERMISSIONS.ACTIVITIES_UPDATE, PERMISSIONS.RESOURCES_READ, PERMISSIONS.RESOURCES_CREATE, PERMISSIONS.QUESTIONS_READ, PERMISSIONS.QUESTIONS_CREATE, PERMISSIONS.QUESTIONS_UPDATE, PERMISSIONS.QUIZZES_READ, PERMISSIONS.QUIZZES_CREATE, PERMISSIONS.QUIZZES_UPDATE, PERMISSIONS.STUDENTS_READ, PERMISSIONS.ENROLLMENTS_READ, PERMISSIONS.PROGRESS_READ, PERMISSIONS.GRADES_READ, PERMISSIONS.GRADES_MANAGE, PERMISSIONS.ASSIGNMENTS_READ, PERMISSIONS.ASSIGNMENTS_GRADE),
  content_editor: pick(PERMISSIONS.COURSES_READ, PERMISSIONS.TRACKS_READ, PERMISSIONS.LESSONS_READ, PERMISSIONS.LESSONS_CREATE, PERMISSIONS.LESSONS_UPDATE, PERMISSIONS.TOPICS_READ, PERMISSIONS.TOPICS_CREATE, PERMISSIONS.TOPICS_UPDATE, PERMISSIONS.ACTIVITIES_READ, PERMISSIONS.ACTIVITIES_CREATE, PERMISSIONS.ACTIVITIES_UPDATE, PERMISSIONS.RESOURCES_READ, PERMISSIONS.RESOURCES_CREATE, PERMISSIONS.RESOURCES_UPDATE, PERMISSIONS.QUESTIONS_READ, PERMISSIONS.QUESTIONS_CREATE, PERMISSIONS.QUESTIONS_UPDATE, PERMISSIONS.QUIZZES_READ, PERMISSIONS.QUIZZES_CREATE, PERMISSIONS.QUIZZES_UPDATE),
  admin: all.filter((code) => ![PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.AUDIT_READ].includes(code)),
  super_admin: all,
});

export const systemRoles = Object.freeze([
  { code: "student", name: "Student", description: "Learner self-service access" },
  { code: "teacher", name: "Teacher", description: "Course-scoped teaching access" },
  { code: "content_editor", name: "Content editor", description: "Course-scoped content access" },
  { code: "admin", name: "Administrator", description: "Operational administration" },
  { code: "super_admin", name: "Super administrator", description: "Platform ownership and security administration" },
]);
