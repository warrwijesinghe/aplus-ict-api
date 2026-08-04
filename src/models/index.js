import { sequelize } from "../config/database.js";
import { defineUser } from "./user.model.js";
import { defineRefreshToken } from "./refresh-token.model.js";
import { defineCategory } from "./category.model.js";
import { defineAcademicLevel } from "./academic-level.model.js";
import { defineCourse } from "./course.model.js";
import { defineMedium } from "./medium.model.js";
import { defineCourseTrack } from "./course-track.model.js";
import { defineLesson } from "./lesson.model.js";
import { defineTopic } from "./topic.model.js";
import { defineLessonSection } from "./lesson-section.model.js";
import { defineEnrolment } from "./enrolment.model.js";
import { defineEntitlement } from "./entitlement.model.js";
import { defineLessonProgress } from "./lesson-progress.model.js";
import { defineResource } from "./resource.model.js";
import { defineProduct } from "./product.model.js";
import { defineOrder } from "./order.model.js";
import { defineOrderItem } from "./order-item.model.js";
import { definePayment } from "./payment.model.js";
import { defineGoogleIdentity } from "./google-identity.model.js";
import { defineStudentProfile } from "./student-profile.model.js";
import { defineRole } from "./role.model.js";
import { definePermission } from "./permission.model.js";
import { defineUserRole } from "./user-role.model.js";
import { defineContentProgress } from "./content-progress.model.js";
import { defineRolePermission } from "./role-permission.model.js";
import { defineDownloadableResource } from "./downloadable-resource.model.js";
import { defineEducatorAssignment } from "./educator-assignment.model.js";
import { defineAuditLog } from "./audit-log.model.js";

// Individual model files own fields; this file owns initialization and relationships.
export const User = defineUser(sequelize);
export const RefreshToken = defineRefreshToken(sequelize);
export const Category = defineCategory(sequelize);
export const AcademicLevel = defineAcademicLevel(sequelize);
export const Course = defineCourse(sequelize);
export const Medium = defineMedium(sequelize);
export const CourseTrack = defineCourseTrack(sequelize);
export const Lesson = defineLesson(sequelize);
export const Topic = defineTopic(sequelize);
export const LessonSection = defineLessonSection(sequelize);
export const Enrolment = defineEnrolment(sequelize);
export const Entitlement = defineEntitlement(sequelize);
export const LessonProgress = defineLessonProgress(sequelize);
export const Resource = defineResource(sequelize);
export const Product = defineProduct(sequelize);
export const Order = defineOrder(sequelize);
export const OrderItem = defineOrderItem(sequelize);
export const Payment = definePayment(sequelize);
export const GoogleIdentity = defineGoogleIdentity(sequelize);
export const StudentProfile = defineStudentProfile(sequelize);
export const Role = defineRole(sequelize);
export const Permission = definePermission(sequelize);
export const UserRole = defineUserRole(sequelize);
export const ContentProgress = defineContentProgress(sequelize);
export const RolePermission = defineRolePermission(sequelize);
export const DownloadableResource = defineDownloadableResource(sequelize);
export const EducatorAssignment = defineEducatorAssignment(sequelize);
export const AuditLog = defineAuditLog(sequelize);

// Catalogue hierarchy: category -> course -> medium track -> lesson -> sections.
Category.hasMany(Course, { foreignKey: "categoryId" });
Course.belongsTo(Category, { foreignKey: "categoryId" });
AcademicLevel.hasMany(Course, { foreignKey: "academicLevelId" });
Course.belongsTo(AcademicLevel, { foreignKey: "academicLevelId" });
Course.hasMany(CourseTrack, { foreignKey: "courseId" });
CourseTrack.belongsTo(Course, { foreignKey: "courseId" });
CourseTrack.belongsTo(Medium, { foreignKey: "mediumId" });
CourseTrack.hasMany(Lesson, { foreignKey: "trackId" });
Lesson.belongsTo(CourseTrack, { foreignKey: "trackId" });
User.hasMany(Enrolment, { foreignKey: "userId" });
Enrolment.belongsTo(User, { foreignKey: "userId" });
CourseTrack.hasMany(Enrolment, { foreignKey: "courseTrackId" });
Enrolment.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
Lesson.hasMany(LessonSection, { foreignKey: "lessonId" });
Lesson.hasMany(Topic, { foreignKey: "lessonId" });
Topic.belongsTo(Lesson, { foreignKey: "lessonId" });
Topic.hasMany(LessonSection, { foreignKey: "topicId" });
LessonSection.belongsTo(Topic, { foreignKey: "topicId" });
Lesson.hasMany(Product, { foreignKey: "lessonId" });
// Commerce relationships. Entitlements retain IDs to preserve a clear commerce/learning boundary.
Order.hasMany(OrderItem, { foreignKey: "orderId" });
Order.hasMany(Payment, { foreignKey: "orderId" });
Payment.belongsTo(Order, { foreignKey: "orderId" });
Payment.belongsTo(Resource, { foreignKey: "paymentSlipResourceId", as: "PaymentSlip" });
Order.belongsTo(User, { foreignKey: "userId" });
OrderItem.belongsTo(Product, { foreignKey: "productId" });
OrderItem.belongsTo(Lesson, { foreignKey: "lessonId" });
Product.belongsTo(Lesson, { foreignKey: "lessonId" });
User.hasOne(StudentProfile, { foreignKey: "userId" });
StudentProfile.belongsTo(User, { foreignKey: "userId" });
User.hasMany(GoogleIdentity, { foreignKey: "userId" });
GoogleIdentity.belongsTo(User, { foreignKey: "userId" });
User.belongsToMany(Role, { through: UserRole, foreignKey: "userId" });
Role.belongsToMany(User, { through: UserRole, foreignKey: "roleId" });
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "roleId",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permissionId",
});
User.hasMany(EducatorAssignment, { foreignKey: "userId", as: "EducatorAssignments" });
EducatorAssignment.belongsTo(User, { foreignKey: "userId", as: "Educator" });
EducatorAssignment.belongsTo(User, { foreignKey: "assignedByUserId", as: "AssignedBy" });
Course.hasMany(EducatorAssignment, { foreignKey: "courseId" });
EducatorAssignment.belongsTo(Course, { foreignKey: "courseId" });
CourseTrack.hasMany(EducatorAssignment, { foreignKey: "courseTrackId" });
EducatorAssignment.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
LessonSection.hasMany(ContentProgress, { foreignKey: "lessonSectionId" });
// A public download entry points to the uploaded file it presents in the catalogue.
Resource.hasOne(DownloadableResource, { foreignKey: "resourceId" });
DownloadableResource.belongsTo(Resource, { foreignKey: "resourceId" });

export const db = {
  sequelize,
  User,
  RefreshToken,
  Category,
  AcademicLevel,
  Course,
  Medium,
  CourseTrack,
  Lesson,
  Topic,
  LessonSection,
  Enrolment,
  Entitlement,
  LessonProgress,
  Resource,
  Product,
  Order,
  OrderItem,
  Payment,
  GoogleIdentity,
  StudentProfile,
  Role,
  Permission,
  UserRole,
  ContentProgress,
  RolePermission,
  DownloadableResource,
  EducatorAssignment,
  AuditLog,
};
