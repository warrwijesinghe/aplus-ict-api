import { DataTypes } from "sequelize";
import { defineModel } from "./helpers.js";

export const QUIZ_ATTEMPT_STATUSES = Object.freeze(["in_progress", "submitted", "auto_graded", "pending_manual_grading", "graded", "abandoned", "expired"]);
export const QUIZ_GRADING_STATUSES = Object.freeze(["not_started", "in_progress", "auto_graded", "pending_manual_grading", "graded"]);

export const defineQuizAttempt = (sequelize) => defineModel(sequelize, "QuizAttempt", {
  quizId: { type: DataTypes.UUID, allowNull: false }, userId: { type: DataTypes.UUID, allowNull: false }, attemptNumber: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM(...QUIZ_ATTEMPT_STATUSES), allowNull: false, defaultValue: "in_progress" }, activeAttemptKey: { type: DataTypes.STRING, unique: true },
  startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }, expiresAt: DataTypes.DATE, submittedAt: DataTypes.DATE, gradedAt: DataTypes.DATE,
  score: DataTypes.DECIMAL(10, 2), maximumScore: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, percentage: DataTypes.DECIMAL(5, 2), passed: DataTypes.BOOLEAN,
  gradingStatus: { type: DataTypes.ENUM(...QUIZ_GRADING_STATUSES), allowNull: false, defaultValue: "not_started" }, selectedQuestionCount: { type: DataTypes.INTEGER, allowNull: false },
  questionOrderSnapshot: { type: DataTypes.JSON, allowNull: false }, quizSettingsSnapshot: { type: DataTypes.JSON, allowNull: false },
});
export const defineQuizAttemptQuestion = (sequelize) => defineModel(sequelize, "QuizAttemptQuestion", {
  quizAttemptId: { type: DataTypes.UUID, allowNull: false }, questionId: { type: DataTypes.UUID, allowNull: false }, quizQuestionId: DataTypes.UUID, questionNumber: { type: DataTypes.INTEGER, allowNull: false }, questionType: { type: DataTypes.STRING, allowNull: false }, marksAvailable: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  questionSnapshot: { type: DataTypes.JSON, allowNull: false }, gradingSnapshot: { type: DataTypes.JSON, allowNull: false },
});
export const defineQuizAnswer = (sequelize) => defineModel(sequelize, "QuizAnswer", {
  quizAttemptId: { type: DataTypes.UUID, allowNull: false }, questionId: { type: DataTypes.UUID, allowNull: false }, quizAttemptQuestionId: { type: DataTypes.UUID, allowNull: false }, questionType: { type: DataTypes.STRING, allowNull: false },
  answerStatus: { type: DataTypes.ENUM("unanswered", "answered", "graded", "pending_manual_grading"), allowNull: false, defaultValue: "unanswered" }, marksAvailable: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, marksAwarded: DataTypes.DECIMAL(10, 2), isCorrect: DataTypes.BOOLEAN,
  requiresManualGrading: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, shortAnswerText: DataTypes.TEXT, numericValue: DataTypes.DECIMAL(20, 6), numericUnit: DataTypes.STRING, essayResponse: DataTypes.TEXT,
  answeredAt: DataTypes.DATE, gradedAt: DataTypes.DATE,
});
export const defineQuizAnswerOption = (sequelize) => defineModel(sequelize, "QuizAnswerOption", { quizAnswerId: { type: DataTypes.UUID, allowNull: false }, questionOptionId: { type: DataTypes.UUID, allowNull: false } });
export const defineQuizAnswerMatchingItem = (sequelize) => defineModel(sequelize, "QuizAnswerMatchingItem", { quizAnswerId: { type: DataTypes.UUID, allowNull: false }, matchingPromptId: { type: DataTypes.UUID, allowNull: false }, selectedMatchId: { type: DataTypes.UUID, allowNull: false } });
export const defineQuizAnswerOrderingItem = (sequelize) => defineModel(sequelize, "QuizAnswerOrderingItem", { quizAnswerId: { type: DataTypes.UUID, allowNull: false }, orderingItemId: { type: DataTypes.UUID, allowNull: false }, submittedPosition: { type: DataTypes.INTEGER, allowNull: false } });
export const defineQuizGrade = (sequelize) => defineModel(sequelize, "QuizGrade", {
  quizAttemptId: { type: DataTypes.UUID, allowNull: false, unique: true }, userId: { type: DataTypes.UUID, allowNull: false }, quizId: { type: DataTypes.UUID, allowNull: false },
  autoGradedMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }, manualGradedMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }, totalMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }, maximumMarks: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, percentage: DataTypes.DECIMAL(5, 2), passed: DataTypes.BOOLEAN,
  gradingStatus: { type: DataTypes.ENUM(...QUIZ_GRADING_STATUSES), allowNull: false }, gradedAt: DataTypes.DATE, gradedByUserId: DataTypes.UUID, teacherFeedback: DataTypes.TEXT,
});
