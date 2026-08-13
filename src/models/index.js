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
import { defineProductEntitlementRule } from "./product-entitlement-rule.model.js";
import { defineOrder } from "./order.model.js";
import { defineOrderItem } from "./order-item.model.js";
import { defineOrderStatusHistory } from "./order-status-history.model.js";
import { definePayment } from "./payment.model.js";
import { definePaymentTransaction } from "./payment-transaction.model.js";
import { definePaymentProviderEvent } from "./payment-provider-event.model.js";
import { defineGoogleIdentity } from "./google-identity.model.js";
import { defineStudentProfile } from "./student-profile.model.js";
import { defineStudentCourseState } from "./student-course-state.model.js";
import { defineStudentLearningHistory } from "./student-learning-history.model.js";
import { defineRole } from "./role.model.js";
import { definePermission } from "./permission.model.js";
import { defineUserRole } from "./user-role.model.js";
import { defineContentProgress } from "./content-progress.model.js";
import { defineRolePermission } from "./role-permission.model.js";
import { defineDownloadableResource } from "./downloadable-resource.model.js";
import { defineEducatorAssignment } from "./educator-assignment.model.js";
import { defineAuditLog } from "./audit-log.model.js";
import { defineResourceLink } from "./resource-link.model.js";
import { defineQuestionCategory, defineQuestion, defineQuestionOption, defineQuestionAcceptedAnswer, defineQuestionNumericAnswer, defineQuestionMatchingPair, defineQuestionOrderingItem, defineQuestionEssayConfig, defineQuestionTag, defineQuestionTagAssignment } from "./question-bank.model.js";
import { defineQuiz, defineQuizQuestion, defineQuizRandomRule } from "./quiz.model.js";
import { defineQuizAttempt, defineQuizAttemptQuestion, defineQuizAnswer, defineQuizAnswerOption, defineQuizAnswerMatchingItem, defineQuizAnswerOrderingItem, defineQuizGrade } from "./quiz-attempt.model.js";
import { defineActivityCompletion } from "./activity-completion.model.js";
import { defineActivityPrerequisite, defineTeacherActivityApproval, defineTeacherGradeComment } from "./activity-prerequisite.model.js";
import { defineSmsInboundMessage, defineSmsMessage, defineSmsMessageAttempt } from "./sms-message.model.js";

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
export const ProductEntitlementRule = defineProductEntitlementRule(sequelize);
export const Order = defineOrder(sequelize);
export const OrderItem = defineOrderItem(sequelize);
export const OrderStatusHistory = defineOrderStatusHistory(sequelize);
export const Payment = definePayment(sequelize);
export const PaymentTransaction = definePaymentTransaction(sequelize);
export const PaymentProviderEvent = definePaymentProviderEvent(sequelize);
export const GoogleIdentity = defineGoogleIdentity(sequelize);
export const StudentProfile = defineStudentProfile(sequelize);
export const StudentCourseState = defineStudentCourseState(sequelize);
export const StudentLearningHistory = defineStudentLearningHistory(sequelize);
export const Role = defineRole(sequelize);
export const Permission = definePermission(sequelize);
export const UserRole = defineUserRole(sequelize);
export const ContentProgress = defineContentProgress(sequelize);
export const RolePermission = defineRolePermission(sequelize);
export const DownloadableResource = defineDownloadableResource(sequelize);
export const EducatorAssignment = defineEducatorAssignment(sequelize);
export const AuditLog = defineAuditLog(sequelize);
export const ResourceLink = defineResourceLink(sequelize);
export const QuestionCategory = defineQuestionCategory(sequelize);
export const Question = defineQuestion(sequelize);
export const QuestionOption = defineQuestionOption(sequelize);
export const QuestionAcceptedAnswer = defineQuestionAcceptedAnswer(sequelize);
export const QuestionNumericAnswer = defineQuestionNumericAnswer(sequelize);
export const QuestionMatchingPair = defineQuestionMatchingPair(sequelize);
export const QuestionOrderingItem = defineQuestionOrderingItem(sequelize);
export const QuestionEssayConfig = defineQuestionEssayConfig(sequelize);
export const QuestionTag = defineQuestionTag(sequelize);
export const QuestionTagAssignment = defineQuestionTagAssignment(sequelize);
export const Quiz = defineQuiz(sequelize);
export const QuizQuestion = defineQuizQuestion(sequelize);
export const QuizRandomRule = defineQuizRandomRule(sequelize);
export const QuizAttempt = defineQuizAttempt(sequelize);
export const QuizAttemptQuestion = defineQuizAttemptQuestion(sequelize);
export const QuizAnswer = defineQuizAnswer(sequelize);
export const QuizAnswerOption = defineQuizAnswerOption(sequelize);
export const QuizAnswerMatchingItem = defineQuizAnswerMatchingItem(sequelize);
export const QuizAnswerOrderingItem = defineQuizAnswerOrderingItem(sequelize);
export const QuizGrade = defineQuizGrade(sequelize);
export const ActivityCompletion = defineActivityCompletion(sequelize);
export const ActivityPrerequisite = defineActivityPrerequisite(sequelize);
export const TeacherActivityApproval = defineTeacherActivityApproval(sequelize);
export const TeacherGradeComment = defineTeacherGradeComment(sequelize);
export const SmsMessage = defineSmsMessage(sequelize);
export const SmsMessageAttempt = defineSmsMessageAttempt(sequelize);
export const SmsInboundMessage = defineSmsInboundMessage(sequelize);

// Catalogue hierarchy: category -> course -> medium track -> lesson -> sections.
Category.hasMany(Course, { foreignKey: "categoryId" });
Course.belongsTo(Category, { foreignKey: "categoryId" });
AcademicLevel.hasMany(Course, { foreignKey: "academicLevelId" });
Course.belongsTo(AcademicLevel, { foreignKey: "academicLevelId" });
Course.hasMany(CourseTrack, { foreignKey: "courseId" });
CourseTrack.belongsTo(Course, { foreignKey: "courseId" });
CourseTrack.belongsTo(Medium, { foreignKey: "mediumId" });
Medium.hasMany(CourseTrack, { foreignKey: "mediumId" });
CourseTrack.hasMany(Lesson, { foreignKey: "trackId" });
Lesson.belongsTo(CourseTrack, { foreignKey: "trackId" });
User.hasMany(Enrolment, { foreignKey: "userId" });
Enrolment.belongsTo(User, { foreignKey: "userId" });
CourseTrack.hasMany(Enrolment, { foreignKey: "courseTrackId" });
Enrolment.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
Lesson.hasMany(LessonSection, { foreignKey: "lessonId" });
LessonSection.belongsTo(Lesson, { foreignKey: "lessonId" });
Lesson.hasMany(Topic, { foreignKey: "lessonId" });
Topic.belongsTo(Lesson, { foreignKey: "lessonId" });
Topic.hasMany(LessonSection, { foreignKey: "topicId" });
LessonSection.belongsTo(Topic, { foreignKey: "topicId" });
Resource.hasMany(LessonSection, { foreignKey: "resourceId" });
LessonSection.belongsTo(Resource, { foreignKey: "resourceId" });
Lesson.hasMany(Product, { foreignKey: "lessonId" });
Course.hasMany(Product, { foreignKey: "courseId" }); Product.belongsTo(Course, { foreignKey: "courseId" });
CourseTrack.hasMany(Product, { foreignKey: "courseTrackId" }); Product.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
// Commerce relationships. Entitlements retain IDs to preserve a clear commerce/learning boundary.
Order.hasMany(OrderItem, { foreignKey: "orderId" });
Order.hasMany(Payment, { foreignKey: "orderId" });
Order.hasMany(PaymentTransaction, { foreignKey: "orderId", as: "PaymentTransactions" });
PaymentTransaction.belongsTo(Order, { foreignKey: "orderId" });
PaymentTransaction.hasMany(PaymentProviderEvent, { foreignKey: "paymentTransactionId", as: "ProviderEvents" });
PaymentProviderEvent.belongsTo(PaymentTransaction, { foreignKey: "paymentTransactionId" });
Payment.belongsTo(Order, { foreignKey: "orderId" });
Payment.belongsTo(Resource, { foreignKey: "paymentSlipResourceId", as: "PaymentSlip" });
Order.belongsTo(User, { foreignKey: "userId" });
OrderItem.belongsTo(Product, { foreignKey: "productId" });
OrderItem.belongsTo(Lesson, { foreignKey: "lessonId" });
Product.belongsTo(Lesson, { foreignKey: "lessonId" });
Product.hasMany(ProductEntitlementRule, { foreignKey: "productId", as: "EntitlementRules" }); ProductEntitlementRule.belongsTo(Product, { foreignKey: "productId" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });
Order.hasMany(OrderStatusHistory, { foreignKey: "orderId", as: "StatusHistory" }); OrderStatusHistory.belongsTo(Order, { foreignKey: "orderId" });
Order.hasMany(Entitlement, { foreignKey: "orderId", as: "Entitlements" }); Entitlement.belongsTo(Order, { foreignKey: "orderId" });
User.hasMany(Entitlement, { foreignKey: "userId" }); Entitlement.belongsTo(User, { foreignKey: "userId" });
Course.hasMany(Entitlement, { foreignKey: "courseId" }); CourseTrack.hasMany(Entitlement, { foreignKey: "courseTrackId" }); Lesson.hasMany(Entitlement, { foreignKey: "lessonId" });
User.hasOne(StudentProfile, { foreignKey: "userId" });
StudentProfile.belongsTo(User, { foreignKey: "userId" });
User.hasMany(StudentCourseState, { foreignKey: "userId" });
StudentCourseState.belongsTo(User, { foreignKey: "userId" });
CourseTrack.hasMany(StudentCourseState, { foreignKey: "courseTrackId" });
StudentCourseState.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
User.hasMany(StudentLearningHistory, { foreignKey: "userId" });
StudentLearningHistory.belongsTo(User, { foreignKey: "userId" });
CourseTrack.hasMany(StudentLearningHistory, { foreignKey: "courseTrackId" });
StudentLearningHistory.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
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
Resource.hasMany(ResourceLink, { foreignKey: "resourceId", as: "Links" });
ResourceLink.belongsTo(Resource, { foreignKey: "resourceId" });
Resource.belongsTo(Resource, { foreignKey: "replacedByResourceId", as: "Replacement" });
Lesson.belongsTo(Resource, { foreignKey: "tutorialImageResourceId", as: "TutorialImage" });
Course.hasMany(QuestionCategory, { foreignKey: "courseId" }); QuestionCategory.belongsTo(Course, { foreignKey: "courseId" });
CourseTrack.hasMany(QuestionCategory, { foreignKey: "courseTrackId" }); QuestionCategory.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
Lesson.hasMany(QuestionCategory, { foreignKey: "lessonId" }); QuestionCategory.belongsTo(Lesson, { foreignKey: "lessonId" }); Topic.hasMany(QuestionCategory, { foreignKey: "topicId" }); QuestionCategory.belongsTo(Topic, { foreignKey: "topicId" });
QuestionCategory.hasMany(QuestionCategory, { foreignKey: "parentCategoryId", as: "Children" }); QuestionCategory.belongsTo(QuestionCategory, { foreignKey: "parentCategoryId", as: "Parent" });
QuestionCategory.hasMany(Question, { foreignKey: "questionCategoryId" }); Question.belongsTo(QuestionCategory, { foreignKey: "questionCategoryId" });
Course.hasMany(Question, { foreignKey: "courseId" }); Question.belongsTo(Course, { foreignKey: "courseId" }); CourseTrack.hasMany(Question, { foreignKey: "courseTrackId" }); Question.belongsTo(CourseTrack, { foreignKey: "courseTrackId" }); Lesson.hasMany(Question, { foreignKey: "lessonId" }); Question.belongsTo(Lesson, { foreignKey: "lessonId" }); Topic.hasMany(Question, { foreignKey: "topicId" }); Question.belongsTo(Topic, { foreignKey: "topicId" });
Question.hasMany(QuestionOption, { foreignKey: "questionId", as: "Options" }); QuestionOption.belongsTo(Question, { foreignKey: "questionId" }); Question.hasMany(QuestionAcceptedAnswer, { foreignKey: "questionId", as: "AcceptedAnswers" }); QuestionAcceptedAnswer.belongsTo(Question, { foreignKey: "questionId" }); Question.hasOne(QuestionNumericAnswer, { foreignKey: "questionId", as: "NumericAnswer" }); QuestionNumericAnswer.belongsTo(Question, { foreignKey: "questionId" }); Question.hasMany(QuestionMatchingPair, { foreignKey: "questionId", as: "MatchingPairs" }); QuestionMatchingPair.belongsTo(Question, { foreignKey: "questionId" }); Question.hasMany(QuestionOrderingItem, { foreignKey: "questionId", as: "OrderingItems" }); QuestionOrderingItem.belongsTo(Question, { foreignKey: "questionId" }); Question.hasOne(QuestionEssayConfig, { foreignKey: "questionId", as: "EssayConfig" }); QuestionEssayConfig.belongsTo(Question, { foreignKey: "questionId" });
Course.hasMany(QuestionTag, { foreignKey: "courseId" }); QuestionTag.belongsTo(Course, { foreignKey: "courseId" }); Question.belongsToMany(QuestionTag, { through: QuestionTagAssignment, foreignKey: "questionId", as: "Tags" }); QuestionTag.belongsToMany(Question, { through: QuestionTagAssignment, foreignKey: "questionTagId" });
Question.hasMany(ResourceLink, { foreignKey: "entityId", as: "ResourceLinks", constraints: false });
LessonSection.hasOne(Quiz, { foreignKey: "lessonSectionId", as: "Quiz" }); Quiz.belongsTo(LessonSection, { foreignKey: "lessonSectionId", as: "Activity" });
Course.hasMany(Quiz, { foreignKey: "courseId" }); Quiz.belongsTo(Course, { foreignKey: "courseId" }); CourseTrack.hasMany(Quiz, { foreignKey: "courseTrackId" }); Quiz.belongsTo(CourseTrack, { foreignKey: "courseTrackId" }); Lesson.hasMany(Quiz, { foreignKey: "lessonId" }); Quiz.belongsTo(Lesson, { foreignKey: "lessonId" }); Topic.hasMany(Quiz, { foreignKey: "topicId" }); Quiz.belongsTo(Topic, { foreignKey: "topicId" });
Quiz.hasMany(QuizQuestion, { foreignKey: "quizId", as: "QuizQuestions" }); QuizQuestion.belongsTo(Quiz, { foreignKey: "quizId" }); Question.hasMany(QuizQuestion, { foreignKey: "questionId" }); QuizQuestion.belongsTo(Question, { foreignKey: "questionId", as: "Question" }); Quiz.hasMany(QuizRandomRule, { foreignKey: "quizId", as: "RandomRules" }); QuizRandomRule.belongsTo(Quiz, { foreignKey: "quizId" });
Quiz.hasMany(QuizAttempt, { foreignKey: "quizId", as: "Attempts" }); QuizAttempt.belongsTo(Quiz, { foreignKey: "quizId" }); User.hasMany(QuizAttempt, { foreignKey: "userId", as: "QuizAttempts" }); QuizAttempt.belongsTo(User, { foreignKey: "userId", as: "Student" });
QuizAttempt.hasMany(QuizAttemptQuestion, { foreignKey: "quizAttemptId", as: "AttemptQuestions" }); QuizAttemptQuestion.belongsTo(QuizAttempt, { foreignKey: "quizAttemptId" }); Question.hasMany(QuizAttemptQuestion, { foreignKey: "questionId" }); QuizAttemptQuestion.belongsTo(Question, { foreignKey: "questionId" });
QuizAttempt.hasMany(QuizAnswer, { foreignKey: "quizAttemptId", as: "Answers" }); QuizAnswer.belongsTo(QuizAttempt, { foreignKey: "quizAttemptId" }); QuizAttemptQuestion.hasOne(QuizAnswer, { foreignKey: "quizAttemptQuestionId", as: "Answer" }); QuizAnswer.belongsTo(QuizAttemptQuestion, { foreignKey: "quizAttemptQuestionId", as: "AttemptQuestion" });
QuizAnswer.hasMany(QuizAnswerOption, { foreignKey: "quizAnswerId", as: "SelectedOptions" }); QuizAnswerOption.belongsTo(QuizAnswer, { foreignKey: "quizAnswerId" }); QuizAnswer.hasMany(QuizAnswerMatchingItem, { foreignKey: "quizAnswerId", as: "MatchingItems" }); QuizAnswerMatchingItem.belongsTo(QuizAnswer, { foreignKey: "quizAnswerId" }); QuizAnswer.hasMany(QuizAnswerOrderingItem, { foreignKey: "quizAnswerId", as: "OrderingItems" }); QuizAnswerOrderingItem.belongsTo(QuizAnswer, { foreignKey: "quizAnswerId" });
QuizAttempt.hasOne(QuizGrade, { foreignKey: "quizAttemptId", as: "Grade" }); QuizGrade.belongsTo(QuizAttempt, { foreignKey: "quizAttemptId" }); Quiz.hasMany(QuizGrade, { foreignKey: "quizId" }); User.hasMany(QuizGrade, { foreignKey: "userId", as: "QuizGrades" });
User.hasMany(ActivityCompletion, { foreignKey: "userId" }); ActivityCompletion.belongsTo(User, { foreignKey: "userId" }); LessonSection.hasMany(ActivityCompletion, { foreignKey: "activityId" }); ActivityCompletion.belongsTo(LessonSection, { foreignKey: "activityId" });
LessonSection.hasMany(ActivityPrerequisite, { foreignKey: "activityId", as: "Prerequisites" }); ActivityPrerequisite.belongsTo(LessonSection, { foreignKey: "activityId", as: "Activity" });
User.hasMany(TeacherActivityApproval, { foreignKey: "userId", as: "ActivityApprovals" }); TeacherActivityApproval.belongsTo(User, { foreignKey: "userId" }); LessonSection.hasMany(TeacherActivityApproval, { foreignKey: "activityId" }); TeacherActivityApproval.belongsTo(LessonSection, { foreignKey: "activityId" });
User.hasMany(TeacherGradeComment, { foreignKey: "userId", as: "GradeComments" }); TeacherGradeComment.belongsTo(User, { foreignKey: "userId" }); CourseTrack.hasMany(TeacherGradeComment, { foreignKey: "courseTrackId" }); TeacherGradeComment.belongsTo(CourseTrack, { foreignKey: "courseTrackId" });
User.hasMany(SmsMessage, { foreignKey: "createdByUserId", as: "SmsMessages" }); SmsMessage.belongsTo(User, { foreignKey: "createdByUserId", as: "CreatedBy" });
SmsMessage.hasMany(SmsMessageAttempt, { foreignKey: "smsMessageId", as: "Attempts" }); SmsMessageAttempt.belongsTo(SmsMessage, { foreignKey: "smsMessageId" });
SmsMessage.belongsTo(SmsMessage, { foreignKey: "resentFromMessageId", as: "ResentFrom" });

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
  ProductEntitlementRule,
  Order,
  OrderItem,
  OrderStatusHistory,
  Payment,
  PaymentTransaction,
  PaymentProviderEvent,
  GoogleIdentity,
  StudentProfile,
  StudentCourseState,
  StudentLearningHistory,
  Role,
  Permission,
  UserRole,
  ContentProgress,
  RolePermission,
  DownloadableResource,
  EducatorAssignment,
  AuditLog,
  ResourceLink,
  QuestionCategory, Question, QuestionOption, QuestionAcceptedAnswer, QuestionNumericAnswer, QuestionMatchingPair, QuestionOrderingItem, QuestionEssayConfig, QuestionTag, QuestionTagAssignment,
  Quiz, QuizQuestion, QuizRandomRule, QuizAttempt, QuizAttemptQuestion, QuizAnswer, QuizAnswerOption, QuizAnswerMatchingItem, QuizAnswerOrderingItem, QuizGrade,
  ActivityCompletion, ActivityPrerequisite, TeacherActivityApproval, TeacherGradeComment,
  SmsMessage, SmsMessageAttempt, SmsInboundMessage,
};
