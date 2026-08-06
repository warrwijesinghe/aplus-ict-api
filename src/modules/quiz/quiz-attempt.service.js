import crypto from "crypto";
import { Op } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { sanitizeEducationalHtml } from "../content/activities/html-sanitizer.js";
import { canAccessContent } from "../learning/access.service.js";
import { candidateWhere } from "./quiz.service.js";
import { recordCompletion } from "../learning/completion-gradebook.service.js";
import { accessState } from "../learning/completion-gradebook.service.js";
import { requireCompletedProfile } from "../students/student-profile.service.js";

const completedStatuses = ["auto_graded", "pending_manual_grading", "graded", "expired"];
const openStatuses = ["in_progress"];
const precise = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const now = () => new Date();
const shuffled = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) { const j = crypto.randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
};
const questionIncludes = [{ model: db.QuestionOption, as: "Options" }, { model: db.QuestionAcceptedAnswer, as: "AcceptedAnswers" }, { model: db.QuestionNumericAnswer, as: "NumericAnswer" }, { model: db.QuestionMatchingPair, as: "MatchingPairs" }, { model: db.QuestionOrderingItem, as: "OrderingItems" }, { model: db.QuestionEssayConfig, as: "EssayConfig" }];
const questionPlain = (question) => question.get ? question.get({ plain: true }) : question;
const text = (value, field, limit = 10000) => { if (typeof value !== "string") throw new ApiError(422, `${field} must be text`); const valueTrimmed = value.trim(); if (valueTrimmed.length > limit) throw new ApiError(422, `${field} is too long`); return valueTrimmed; };
const normalize = (value) => String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

const attemptSettings = (quiz) => ({ title: quiz.title, description: quiz.description, instructions: quiz.instructions, passPercentage: Number(quiz.passPercentage), timeLimitMinutes: quiz.timeLimitMinutes, feedbackMode: quiz.feedbackMode, showCorrectAnswers: Boolean(quiz.showCorrectAnswers), showScore: Boolean(quiz.showScore), showExplanations: Boolean(quiz.showExplanations), gradingMethod: quiz.gradingMethod, availableUntil: quiz.availableUntil });
const snapshotQuestion = (question, quiz, optionOrder) => ({
  id: question.id, questionText: question.questionText, questionTextFormat: question.questionTextFormat, title: question.title, questionType: question.questionType,
  options: optionOrder.map((id) => question.Options.find((item) => item.id === id)).filter(Boolean).map((item) => ({ id: item.id, optionText: item.optionText, optionTextFormat: item.optionTextFormat })),
  matchingPrompts: (question.MatchingPairs || []).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({ id: item.id, promptText: item.promptText })),
  matchingChoices: shuffled(question.MatchingPairs || []).map((item) => ({ id: item.id, matchText: item.matchText })),
  orderingItems: shuffled(question.OrderingItems || []).map((item) => ({ id: item.id, itemText: item.itemText })),
  essayConfig: question.EssayConfig && { minimumWords: question.EssayConfig.minimumWords, maximumWords: question.EssayConfig.maximumWords, responseFormat: question.EssayConfig.responseFormat },
});
const gradingQuestion = (question) => ({
  options: (question.Options || []).map((item) => ({ id: item.id, isCorrect: item.isCorrect })), acceptedAnswers: (question.AcceptedAnswers || []).map((item) => ({ answerText: item.answerText, isCaseSensitive: item.isCaseSensitive, matchMode: item.matchMode })),
  numericAnswer: question.NumericAnswer && { answerValue: question.NumericAnswer.answerValue, toleranceType: question.NumericAnswer.toleranceType, toleranceValue: question.NumericAnswer.toleranceValue, minimumValue: question.NumericAnswer.minimumValue, maximumValue: question.NumericAnswer.maximumValue },
  matchingPairs: (question.MatchingPairs || []).map((item) => ({ id: item.id })), orderingItems: (question.OrderingItems || []).map((item) => ({ id: item.id, correctPosition: item.correctPosition })),
  explanation: question.explanation, correctFeedback: question.correctFeedback, incorrectFeedback: question.incorrectFeedback, generalFeedback: question.generalFeedback,
});

export const assertStudentQuizAccess = async (userId, quiz, transaction, { enforceAvailability = true } = {}) => {
  await requireCompletedProfile(userId);
  if (!quiz || quiz.status !== "published") throw new ApiError(404, "Quiz not found");
  const activity = await db.LessonSection.findOne({ where: { id: quiz.lessonSectionId, type: "quiz", status: "published" }, transaction });
  if (!activity) throw new ApiError(404, "Quiz activity is not available");
  const enrollment = await db.Enrolment.findOne({ where: { userId, courseTrackId: quiz.courseTrackId, status: "active" }, transaction });
  if (!enrollment) throw new ApiError(403, "Course enrollment is required");
  const lesson = await db.Lesson.findByPk(quiz.lessonId, { transaction });
  if (!lesson || !(await canAccessContent(userId, lesson, activity))) throw new ApiError(403, "Premium content access required");
  const state = await accessState(userId, activity.id, transaction);
  if (state.locked) throw new ApiError(403, "Activity prerequisites are not met");
  const current = now();
  if (enforceAvailability && quiz.availableFrom && new Date(quiz.availableFrom) > current) throw new ApiError(409, "Quiz is not available yet");
  if (enforceAvailability && quiz.availableUntil && new Date(quiz.availableUntil) <= current) throw new ApiError(409, "Quiz is no longer available");
  return { activity, enrollment };
};

const buildAttemptQuestions = async (quiz, transaction) => {
  const manualRows = await db.QuizQuestion.findAll({ where: { quizId: quiz.id }, include: [{ model: db.Question, as: "Question", required: true, include: questionIncludes }], order: [["sortOrder", "ASC"]], transaction });
  const selected = [], selectedIds = new Set();
  for (const row of manualRows) if (row.Question.status === "published" && !row.Question.archivedAt) { selected.push({ question: questionPlain(row.Question), quizQuestionId: row.id, marks: Number(row.marks) }); selectedIds.add(row.Question.id); }
  const rules = await db.QuizRandomRule.findAll({ where: { quizId: quiz.id }, order: [["sortOrder", "ASC"]], transaction });
  for (const rule of rules) {
    const candidates = await db.Question.findAll({ where: { ...candidateWhere(quiz, rule.get({ plain: true })), id: { [Op.notIn]: [...selectedIds] }, archivedAt: null }, include: questionIncludes, transaction });
    if (candidates.length < rule.questionCount) throw new ApiError(422, "Not enough eligible Questions for this Quiz attempt");
    for (const item of shuffled(candidates).slice(0, rule.questionCount)) { const question = questionPlain(item); selected.push({ question, quizQuestionId: null, marks: Number(rule.marksPerQuestion) }); selectedIds.add(question.id); }
  }
  const limited = quiz.questionsPerAttempt ? (quiz.questionsPerAttempt > selected.length ? (() => { throw new ApiError(422, "Not enough eligible Questions for this Quiz attempt"); })() : selected.slice(0, quiz.questionsPerAttempt)) : selected;
  if (!limited.length) throw new ApiError(422, "Quiz has no eligible Questions");
  return quiz.shuffleQuestions ? shuffled(limited) : limited;
};

const createAttemptRecord = async (quiz, userId, transaction) => {
  const existing = await db.QuizAttempt.findOne({ where: { quizId: quiz.id, userId, status: { [Op.in]: openStatuses } }, lock: transaction.LOCK.UPDATE, transaction });
  if (existing) return { attempt: existing, created: false };
  const count = await db.QuizAttempt.count({ where: { quizId: quiz.id, userId }, transaction, lock: transaction.LOCK.UPDATE });
  if (quiz.attemptsAllowed && count >= quiz.attemptsAllowed) throw new ApiError(409, "Attempt limit reached");
  const selected = await buildAttemptQuestions(quiz, transaction), startedAt = now(), expiresAt = quiz.timeLimitMinutes ? new Date(startedAt.getTime() + Number(quiz.timeLimitMinutes) * 60000) : null;
  const attempt = await db.QuizAttempt.create({ quizId: quiz.id, userId, attemptNumber: count + 1, status: "in_progress", activeAttemptKey: `${quiz.id}:${userId}`, startedAt, expiresAt, maximumScore: precise(selected.reduce((sum, item) => sum + item.marks, 0)), selectedQuestionCount: selected.length, questionOrderSnapshot: selected.map((item) => item.question.id), quizSettingsSnapshot: attemptSettings(quiz) }, { transaction });
  await db.QuizAttemptQuestion.bulkCreate(selected.map((item, index) => { const optionOrder = quiz.shuffleOptions ? shuffled(item.question.Options || []).map((option) => option.id) : (item.question.Options || []).sort((a, b) => a.sortOrder - b.sortOrder).map((option) => option.id); return { quizAttemptId: attempt.id, questionId: item.question.id, quizQuestionId: item.quizQuestionId, questionNumber: index + 1, questionType: item.question.questionType, marksAvailable: item.marks, questionSnapshot: snapshotQuestion(item.question, quiz, optionOrder), gradingSnapshot: gradingQuestion(item.question) }; }), { transaction });
  return { attempt, created: true };
};

const answerInclude = [{ model: db.QuizAnswerOption, as: "SelectedOptions" }, { model: db.QuizAnswerMatchingItem, as: "MatchingItems" }, { model: db.QuizAnswerOrderingItem, as: "OrderingItems" }];
const loadAttempt = (id, transaction, lock = false) => db.QuizAttempt.findByPk(id, { include: [{ model: db.Quiz, as: undefined }, { model: db.QuizAttemptQuestion, as: "AttemptQuestions", include: [{ model: db.QuizAnswer, as: "Answer", include: answerInclude }] }, { model: db.QuizGrade, as: "Grade" }], transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
const scoreVisible = (attempt, at = now()) => attempt.quizSettingsSnapshot.showScore && (attempt.quizSettingsSnapshot.feedbackMode === "immediate" || attempt.quizSettingsSnapshot.feedbackMode === "after_submission" || (attempt.quizSettingsSnapshot.feedbackMode === "after_quiz_closes" && attempt.quizSettingsSnapshot.availableUntil && new Date(attempt.quizSettingsSnapshot.availableUntil) <= at));
const feedbackVisible = (attempt, at = now()) => attempt.status !== "in_progress" && (attempt.quizSettingsSnapshot.feedbackMode === "immediate" || attempt.quizSettingsSnapshot.feedbackMode === "after_submission" || (attempt.quizSettingsSnapshot.feedbackMode === "after_quiz_closes" && attempt.quizSettingsSnapshot.availableUntil && new Date(attempt.quizSettingsSnapshot.availableUntil) <= at));
const responseForAnswer = (answer) => !answer ? null : ({ optionIds: (answer.SelectedOptions || []).map((item) => item.questionOptionId), text: answer.shortAnswerText || answer.essayResponse || null, numericValue: answer.numericValue, numericUnit: answer.numericUnit, pairs: (answer.MatchingItems || []).map((item) => ({ promptId: item.matchingPromptId, matchId: item.selectedMatchId })), items: (answer.OrderingItems || []).map((item) => ({ itemId: item.orderingItemId, position: item.submittedPosition })) });
const studentQuestion = (row, { revealFeedback = false, revealCorrect = false, revealExplanations = false, revealScore = false } = {}) => ({ id: row.questionId, attemptQuestionId: row.id, number: row.questionNumber, questionType: row.questionType, marksAvailable: Number(row.marksAvailable), ...row.questionSnapshot, response: responseForAnswer(row.Answer), navigation: { answered: Boolean(row.Answer?.answeredAt) }, ...(revealScore ? { marksAwarded: row.Answer?.marksAwarded === null || row.Answer?.marksAwarded === undefined ? null : Number(row.Answer.marksAwarded) } : {}), ...(revealFeedback ? { isCorrect: row.Answer?.isCorrect ?? null, feedback: row.Answer?.isCorrect ? row.gradingSnapshot?.correctFeedback : row.gradingSnapshot?.incorrectFeedback || row.gradingSnapshot?.generalFeedback || null } : {}), ...(revealCorrect ? { correctAnswer: row.gradingSnapshot && row.questionSnapshot ? permittedCorrectAnswer(row) : undefined } : {}), ...(revealExplanations ? { explanation: row.gradingSnapshot?.explanation || null } : {}) });
const permittedCorrectAnswer = (row) => ({ optionIds: row.gradingSnapshot.options?.filter((item) => item.isCorrect).map((item) => item.id), acceptedAnswers: row.gradingSnapshot.acceptedAnswers?.map((item) => item.answerText), numericAnswer: row.gradingSnapshot.numericAnswer?.answerValue, matchingPairs: row.gradingSnapshot.matchingPairs, orderingItems: row.gradingSnapshot.orderingItems });
const summary = (attempt) => ({ id: attempt.id, quizId: attempt.quizId, attemptNumber: attempt.attemptNumber, status: attempt.status, startedAt: attempt.startedAt, expiresAt: attempt.expiresAt, submittedAt: attempt.submittedAt, gradingStatus: attempt.gradingStatus, remainingTimeSeconds: attempt.expiresAt ? Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - Date.now()) / 1000)) : null, ...(scoreVisible(attempt) ? { score: attempt.score === null ? null : Number(attempt.score), maximumScore: Number(attempt.maximumScore), percentage: attempt.percentage === null ? null : Number(attempt.percentage), passed: attempt.passed } : {}), pendingManualGrading: attempt.gradingStatus === "pending_manual_grading" });
export const serializeAttempt = (attempt, { includeQuestions = true, includeFeedback = false } = {}) => {
  const feedback = includeFeedback && feedbackVisible(attempt);
  const visibility = { revealFeedback: feedback, revealCorrect: feedback && attempt.quizSettingsSnapshot.showCorrectAnswers, revealExplanations: feedback && attempt.quizSettingsSnapshot.showExplanations, revealScore: scoreVisible(attempt) };
  return { ...summary(attempt), quiz: { id: attempt.quizId, ...attempt.quizSettingsSnapshot }, questions: includeQuestions ? (attempt.AttemptQuestions || []).sort((a, b) => a.questionNumber - b.questionNumber).map((row) => studentQuestion(row, visibility)) : undefined };
};

export const studentQuizLanding = async (userId, quizId) => db.sequelize.transaction(async (transaction) => {
  const quiz = await db.Quiz.findByPk(quizId, { transaction }); await assertStudentQuizAccess(userId, quiz, transaction, { enforceAvailability: false });
  const attempts = await db.QuizAttempt.findAll({ where: { quizId, userId }, order: [["attemptNumber", "DESC"]], transaction }); const active = attempts.find((item) => item.status === "in_progress");
  return { quiz: { id: quiz.id, title: quiz.title, description: quiz.description, instructions: quiz.instructions, availableFrom: quiz.availableFrom, availableUntil: quiz.availableUntil, timeLimitMinutes: quiz.timeLimitMinutes, attemptsAllowed: quiz.attemptsAllowed, passPercentage: Number(quiz.passPercentage), gradingMethod: quiz.gradingMethod }, attemptsUsed: attempts.length, remainingAttempts: Math.max(0, Number(quiz.attemptsAllowed || 0) - attempts.length), resumableAttemptId: active?.id || null, attempts: attempts.map(summary) };
});
export const startAttempt = async (userId, quizId) => db.sequelize.transaction(async (transaction) => { const quiz = await db.Quiz.findByPk(quizId, { transaction, lock: transaction.LOCK.UPDATE }); await assertStudentQuizAccess(userId, quiz, transaction); const { attempt, created } = await createAttemptRecord(quiz, userId, transaction); if (created) await db.StudentLearningHistory.create({ userId, courseTrackId: quiz.courseTrackId, lessonId: quiz.lessonId, topicId: quiz.topicId || null, activityId: quiz.lessonSectionId, quizId: quiz.id, quizAttemptId: attempt.id, eventType: "quiz_started", occurredAt: now() }, { transaction }); const loaded = await loadAttempt(attempt.id, transaction); return serializeAttempt(loaded); });

const assertOwner = (attempt, userId) => { if (!attempt || attempt.userId !== userId) throw new ApiError(404, "Quiz attempt not found"); };
const expiry = async (attempt, transaction) => { if (attempt.status === "in_progress" && attempt.expiresAt && new Date(attempt.expiresAt) <= now()) await gradeAttempt(attempt, transaction, true); };
export const getAttempt = async (userId, attemptId) => db.sequelize.transaction(async (transaction) => { let attempt = await loadAttempt(attemptId, transaction, true); assertOwner(attempt, userId); await expiry(attempt, transaction); if (attempt.changed()) await attempt.save({ transaction }); attempt = await loadAttempt(attemptId, transaction); return serializeAttempt(attempt); });

const clearAnswerRows = async (answer, transaction) => Promise.all([db.QuizAnswerOption.destroy({ where: { quizAnswerId: answer.id }, transaction }), db.QuizAnswerMatchingItem.destroy({ where: { quizAnswerId: answer.id }, transaction }), db.QuizAnswerOrderingItem.destroy({ where: { quizAnswerId: answer.id }, transaction })]);
const validateResponse = (row, body) => {
  const snap = row.questionSnapshot, type = row.questionType;
  if (["single_choice", "multiple_choice", "true_false"].includes(type)) { const ids = body.optionIds || []; if (!Array.isArray(ids) || new Set(ids).size !== ids.length || (type !== "multiple_choice" && ids.length > 1) || ids.some((id) => !snap.options.some((option) => option.id === id))) throw new ApiError(422, "Invalid option selection"); return { optionIds: ids }; }
  if (type === "short_answer") return { text: text(body.text || "", "Answer", 2000) };
  if (type === "numeric") { if (body.value === "" || body.value === null || body.value === undefined) return { value: null, unit: "" }; if (!/^-?\d+(\.\d+)?$/.test(String(body.value)) || String(body.value).length > 30) throw new ApiError(422, "Invalid numeric answer"); return { value: String(body.value), unit: text(body.unit || "", "Unit", 50) }; }
  if (type === "matching") { const pairs = body.pairs || []; const prompts = new Set(snap.matchingPrompts.map((item) => item.id)), matches = new Set(snap.matchingChoices.map((item) => item.id)); if (!Array.isArray(pairs) || new Set(pairs.map((item) => item.promptId)).size !== pairs.length || new Set(pairs.map((item) => item.matchId)).size !== pairs.length || pairs.some((item) => !prompts.has(item.promptId) || !matches.has(item.matchId))) throw new ApiError(422, "Invalid matching response"); return { pairs }; }
  if (type === "ordering") { const items = body.items || []; const ids = new Set(snap.orderingItems.map((item) => item.id)); if (!Array.isArray(items) || new Set(items.map((item) => item.itemId)).size !== items.length || new Set(items.map((item) => item.position)).size !== items.length || items.some((item) => !ids.has(item.itemId) || !Number.isInteger(item.position) || item.position < 1 || item.position > ids.size)) throw new ApiError(422, "Invalid ordering response"); return { items }; }
  if (type === "essay") { const value = text(body.text || "", "Essay response", 30000); const plain = value.replace(/<[^>]*>/g, " ").trim(); const words = plain ? plain.split(/\s+/).length : 0; if (snap.essayConfig?.maximumWords && words > snap.essayConfig.maximumWords) throw new ApiError(422, "Essay exceeds the word limit"); if (snap.essayConfig?.responseFormat === "plain_text") return { text: value.replace(/<[^>]*>/g, "") }; return { text: sanitizeEducationalHtml(value) }; }
  throw new ApiError(422, "Unsupported question type");
};
export const saveAnswer = async (userId, attemptId, questionId, body) => db.sequelize.transaction(async (transaction) => { const attempt = await loadAttempt(attemptId, transaction, true); assertOwner(attempt, userId); await expiry(attempt, transaction); if (attempt.status !== "in_progress") throw new ApiError(409, "Quiz attempt is no longer editable"); const row = attempt.AttemptQuestions.find((item) => item.questionId === questionId); if (!row) throw new ApiError(404, "Question is not part of this attempt"); const response = validateResponse(row, body); let answer = row.Answer; if (!answer) answer = await db.QuizAnswer.create({ quizAttemptId: attempt.id, questionId: row.questionId, quizAttemptQuestionId: row.id, questionType: row.questionType, marksAvailable: row.marksAvailable, requiresManualGrading: row.questionType === "essay" }, { transaction }); await clearAnswerRows(answer, transaction);
  await answer.update({ answerStatus: "answered", shortAnswerText: row.questionType === "short_answer" ? response.text : null, numericValue: row.questionType === "numeric" ? response.value : null, numericUnit: row.questionType === "numeric" ? response.unit : null, essayResponse: row.questionType === "essay" ? response.text : null, answeredAt: now() }, { transaction });
  if (response.optionIds) await db.QuizAnswerOption.bulkCreate(response.optionIds.map((questionOptionId) => ({ quizAnswerId: answer.id, questionOptionId })), { transaction }); if (response.pairs) await db.QuizAnswerMatchingItem.bulkCreate(response.pairs.map((item) => ({ quizAnswerId: answer.id, matchingPromptId: item.promptId, selectedMatchId: item.matchId })), { transaction }); if (response.items) await db.QuizAnswerOrderingItem.bulkCreate(response.items.map((item) => ({ quizAnswerId: answer.id, orderingItemId: item.itemId, submittedPosition: item.position })), { transaction });
  const refreshed = await db.QuizAnswer.findByPk(answer.id, { include: answerInclude, transaction }); return { questionId, response: responseForAnswer(refreshed), savedAt: refreshed.answeredAt };
});

const gradeAnswer = (answer, row) => { const marks = Number(row.marksAvailable), grading = row.gradingSnapshot || {}, selected = new Set((answer?.SelectedOptions || []).map((item) => item.questionOptionId)); let correct = false, pending = false;
  if (!answer?.answeredAt) correct = false;
  else if (["single_choice", "multiple_choice", "true_false"].includes(row.questionType)) { const keys = grading.options.filter((item) => item.isCorrect).map((item) => item.id); correct = keys.length === selected.size && keys.every((id) => selected.has(id)); }
  else if (row.questionType === "short_answer") correct = grading.acceptedAnswers.some((item) => item.matchMode === "exact" ? (item.isCaseSensitive ? answer.shortAnswerText === item.answerText : String(answer.shortAnswerText).toLocaleLowerCase() === String(item.answerText).toLocaleLowerCase()) : (item.isCaseSensitive ? String(answer.shortAnswerText).trim() === String(item.answerText).trim() : normalize(answer.shortAnswerText) === normalize(item.answerText)));
  else if (row.questionType === "numeric") { const config = grading.numericAnswer, value = Number(answer.numericValue); if (config && Number.isFinite(value)) correct = config.toleranceType === "range" && (config.minimumValue !== null || config.maximumValue !== null) ? (config.minimumValue === null || value >= Number(config.minimumValue)) && (config.maximumValue === null || value <= Number(config.maximumValue)) : Math.abs(value - Number(config.answerValue)) <= Number(config.toleranceValue || 0); }
  else if (row.questionType === "matching") { const values = answer.MatchingItems || []; correct = values.length === grading.matchingPairs.length && values.every((item) => item.matchingPromptId === item.selectedMatchId); }
  else if (row.questionType === "ordering") { const positions = new Map((answer.OrderingItems || []).map((item) => [item.orderingItemId, item.submittedPosition])); correct = positions.size === grading.orderingItems.length && grading.orderingItems.every((item) => positions.get(item.id) === item.correctPosition); }
  else if (row.questionType === "essay") pending = true;
  return { marks: pending ? null : (correct ? marks : 0), correct: pending ? null : correct, pending };
};
const updateCompletion = async (attempt, transaction) => {
  const activity = await db.LessonSection.findByPk(attempt.quizSettingsSnapshot.lessonSectionId || (await db.Quiz.findByPk(attempt.quizId, { transaction }))?.lessonSectionId, { transaction });
  if (!activity || !["submit", "pass"].includes(activity.completionMode)) return;
  const complete = activity.completionMode === "submit" || (activity.completionMode === "pass" && attempt.gradingStatus === "graded" && attempt.passed === true);
  if (!complete) return;
  await recordCompletion(attempt.userId, activity.id, activity.completionMode === "pass" ? "quiz_pass" : "quiz_submission", attempt.id, transaction);
};
const gradeAttempt = async (attempt, transaction, expired = false) => {
  if (completedStatuses.includes(attempt.status)) return attempt;
  const rows = await db.QuizAttemptQuestion.findAll({ where: { quizAttemptId: attempt.id }, include: [{ model: db.QuizAnswer, as: "Answer", include: answerInclude }], transaction, lock: transaction.LOCK.UPDATE }); let automatic = 0, pending = false;
  for (const row of rows) { let answer = row.Answer; if (!answer) answer = await db.QuizAnswer.create({ quizAttemptId: attempt.id, questionId: row.questionId, quizAttemptQuestionId: row.id, questionType: row.questionType, marksAvailable: row.marksAvailable, requiresManualGrading: row.questionType === "essay" }, { transaction }); const result = gradeAnswer(answer, { ...row.get({ plain: true }), Answer: answer }); pending ||= result.pending; automatic += result.marks || 0; await answer.update({ answerStatus: result.pending ? "pending_manual_grading" : "graded", marksAwarded: result.marks, isCorrect: result.correct, requiresManualGrading: result.pending, gradedAt: result.pending ? null : now() }, { transaction }); }
  const maximum = Number(attempt.maximumScore), percentage = maximum ? precise((automatic / maximum) * 100) : 0, status = pending ? "pending_manual_grading" : "graded", passed = pending ? null : percentage >= Number(attempt.quizSettingsSnapshot.passPercentage || 0), when = now();
  await attempt.update({ status: expired ? "expired" : status, activeAttemptKey: null, submittedAt: when, gradedAt: pending ? null : when, score: automatic, percentage, passed, gradingStatus: pending ? "pending_manual_grading" : "graded" }, { transaction });
  await db.QuizGrade.upsert({ quizAttemptId: attempt.id, userId: attempt.userId, quizId: attempt.quizId, autoGradedMarks: automatic, manualGradedMarks: 0, totalMarks: automatic, maximumMarks: maximum, percentage, passed, gradingStatus: pending ? "pending_manual_grading" : "graded", gradedAt: pending ? null : when }, { transaction });
  await updateCompletion(attempt, transaction);
  return attempt;
};
export const submitAttempt = async (userId, attemptId) => db.sequelize.transaction(async (transaction) => { let attempt = await loadAttempt(attemptId, transaction, true); assertOwner(attempt, userId); if (completedStatuses.includes(attempt.status)) return serializeAttempt(attempt, { includeQuestions: false, includeFeedback: true }); const quiz = await db.Quiz.findByPk(attempt.quizId, { transaction }); const expired = Boolean(attempt.expiresAt && new Date(attempt.expiresAt) <= now()); await gradeAttempt(attempt, transaction, expired); await db.StudentLearningHistory.create({ userId, courseTrackId: quiz.courseTrackId, lessonId: quiz.lessonId, topicId: quiz.topicId || null, activityId: quiz.lessonSectionId, quizId: quiz.id, quizAttemptId: attempt.id, eventType: "quiz_submitted", occurredAt: now() }, { transaction }); if (attempt.passed === true) await db.StudentLearningHistory.create({ userId, courseTrackId: quiz.courseTrackId, lessonId: quiz.lessonId, topicId: quiz.topicId || null, activityId: quiz.lessonSectionId, quizId: quiz.id, quizAttemptId: attempt.id, eventType: "quiz_passed", occurredAt: now() }, { transaction }); attempt = await loadAttempt(attemptId, transaction); return serializeAttempt(attempt, { includeQuestions: false, includeFeedback: true }); });
export const listAttempts = async (userId, quizId) => { const quiz = await db.Quiz.findByPk(quizId); await assertStudentQuizAccess(userId, quiz, undefined, { enforceAvailability: false }); const attempts = await db.QuizAttempt.findAll({ where: { quizId, userId }, order: [["attemptNumber", "DESC"]] }); return attempts.map(summary); };
export const attemptResult = async (userId, attemptId) => db.sequelize.transaction(async (transaction) => { let attempt = await loadAttempt(attemptId, transaction, true); assertOwner(attempt, userId); await expiry(attempt, transaction); attempt = await loadAttempt(attemptId, transaction); return serializeAttempt(attempt, { includeQuestions: true, includeFeedback: true }); });
export const quizResultForStudent = async (userId, quizId) => { const rows = await db.QuizAttempt.findAll({ where: { userId, quizId, gradingStatus: "graded" }, order: [["submittedAt", "ASC"]] }); if (!rows.length) return null; const scores = rows.map((item) => Number(item.percentage)); const method = rows[0].quizSettingsSnapshot.gradingMethod; const selected = method === "latest" ? rows.at(-1) : method === "first" ? rows[0] : method === "highest" ? rows.reduce((best, item) => Number(item.percentage) > Number(best.percentage) ? item : best) : null; return method === "average" ? { gradingMethod: method, percentage: precise(scores.reduce((sum, score) => sum + score, 0) / scores.length), completedAttempts: rows.length } : { gradingMethod: method, attemptId: selected.id, percentage: Number(selected.percentage), passed: selected.passed, completedAttempts: rows.length }; };
const assertGrader = async (user, attempt, transaction) => { if (["admin", "super_admin"].includes(user.role)) return; const assignment = await db.EducatorAssignment.findOne({ where: { userId: user.sub, status: "active", [Op.or]: [{ courseTrackId: attempt.Quiz.courseTrackId }, { courseId: attempt.Quiz.courseId }], canGradeAssignments: true }, transaction }); if (!assignment) throw new ApiError(403, "You are not assigned to grade this Quiz"); };
export const pendingEssayAnswers = async (user) => { const rows = await db.QuizAnswer.findAll({ where: { requiresManualGrading: true, answerStatus: "pending_manual_grading" }, include: [{ model: db.QuizAttempt, as: undefined, include: [{ model: db.Quiz, as: undefined }] }, { model: db.QuizAttemptQuestion, as: "AttemptQuestion" }] }); const allowed = []; for (const row of rows) { await assertGrader(user, row.QuizAttempt); allowed.push({ id: row.id, quizId: row.QuizAttempt.quizId, attemptId: row.quizAttemptId, questionId: row.questionId, questionText: row.AttemptQuestion.questionSnapshot.questionText, studentId: row.QuizAttempt.userId, marksAvailable: Number(row.marksAvailable), submittedAt: row.QuizAttempt.submittedAt }); } return allowed; };
export const gradeEssayAnswer = async (user, answerId, body) => db.sequelize.transaction(async (transaction) => {
  const answer = await db.QuizAnswer.findByPk(answerId, { include: [{ model: db.QuizAttempt, include: [db.Quiz] }, { model: db.QuizAttemptQuestion, as: "AttemptQuestion" }], transaction, lock: transaction.LOCK.UPDATE });
  if (!answer || !answer.requiresManualGrading) throw new ApiError(404, "Pending essay answer not found");
  await assertGrader(user, answer.QuizAttempt, transaction);
  const marks = Number(body.marksAwarded);
  if (!Number.isFinite(marks) || marks < 0 || marks > Number(answer.marksAvailable)) throw new ApiError(422, "Marks must be within the available range");
  const feedback = body.teacherFeedback === undefined ? undefined : text(body.teacherFeedback || "", "Teacher feedback", 5000);
  await answer.update({ marksAwarded: precise(marks), isCorrect: marks === Number(answer.marksAvailable), answerStatus: "graded", gradedAt: now() }, { transaction });
  const remaining = await db.QuizAnswer.count({ where: { quizAttemptId: answer.quizAttemptId, requiresManualGrading: true, answerStatus: "pending_manual_grading" }, transaction });
  const allAnswers = await db.QuizAnswer.findAll({ where: { quizAttemptId: answer.quizAttemptId }, transaction });
  const total = precise(allAnswers.reduce((sum, item) => sum + Number(item.marksAwarded || 0), 0)), maximum = Number(answer.QuizAttempt.maximumScore), percentage = maximum ? precise((total / maximum) * 100) : 0, done = remaining === 0, passed = done ? percentage >= Number(answer.QuizAttempt.quizSettingsSnapshot.passPercentage || 0) : null;
  await answer.QuizAttempt.update({ score: total, percentage, passed, status: done ? "graded" : "pending_manual_grading", gradingStatus: done ? "graded" : "pending_manual_grading", gradedAt: done ? now() : null }, { transaction });
  await db.QuizGrade.update({ manualGradedMarks: precise(allAnswers.filter((item) => item.requiresManualGrading).reduce((sum, item) => sum + Number(item.marksAwarded || 0), 0)), totalMarks: total, percentage, passed, gradingStatus: done ? "graded" : "pending_manual_grading", gradedAt: done ? now() : null, gradedByUserId: user.sub, ...(feedback !== undefined ? { teacherFeedback: feedback } : {}) }, { where: { quizAttemptId: answer.quizAttemptId }, transaction });
  await updateCompletion(answer.QuizAttempt, transaction);
  return { answerId: answer.id, attemptId: answer.quizAttemptId, finalized: done, score: total, percentage };
});
