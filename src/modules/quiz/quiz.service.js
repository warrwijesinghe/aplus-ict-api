import { Op, QueryTypes } from "sequelize";
import { ApiError } from "../../core/errors.js";
import { db } from "../../models/index.js";
import { hasCourseAssignment, privilegedRoles } from "../../security/authorization.js";
import { assertPublishable, normalizeTypeSpecificData, validateQuestionDraft } from "./question-validator.js";
import { escapeQuestionText, parseAiken } from "./aiken.js";
import { loadRandomRules, quizQuestionWriter } from "./quiz-schema.js";

const editedText = (value) => {
  if (typeof value !== "string" || !value.trim() || value.length > 4000)
    throw new ApiError(422, "Enter question and option text between 1 and 4,000 characters.");
  return escapeQuestionText(value.trim());
};

export const editQuizQuestion = (quizId, rowId, body, user) => db.sequelize.transaction(async (transaction) => {
  const lock = transaction.LOCK.UPDATE;
  const quiz = await db.Quiz.findByPk(quizId, { transaction, lock });
  if (!quiz) throw new ApiError(404, "Quiz not found");
  await assertQuizScope(user, quiz);
  if (quiz.status === "archived") throw new ApiError(409, "Archived quizzes cannot be edited.");
  const row = await db.QuizQuestion.findOne({ where: { id: rowId, quizId }, transaction, lock });
  if (!row) throw new ApiError(404, "Quiz question not found");
  const question = await db.Question.findByPk(row.questionId, { transaction, lock });
  if (question?.questionType !== "single_choice" || question.status !== "published")
    throw new ApiError(422, "Only published single-answer multiple-choice questions can be edited here.");
  const links = await db.QuizQuestion.count({ where: { questionId: question.id }, transaction });
  if (links > 1) throw new ApiError(409, "This question is shared by multiple quizzes. Upload a separate copy to edit it here.");
  const ruleQuizzes = await db.sequelize.query(`
    SELECT DISTINCT r.quizId FROM quiz_random_rules r
    JOIN quizzes q ON q.id = r.quizId WHERE q.courseTrackId = :trackId
  `, { replacements: { trackId: quiz.courseTrackId }, type: QueryTypes.SELECT, transaction });
  for (const ruleQuiz of ruleQuizzes) {
    const rules = await loadRandomRules(ruleQuiz.quizId, transaction);
    if (rules.some((rule) => rule.questionIds.includes(question.id)))
      throw new ApiError(409, "This question belongs to an existing random rule. Upload a separate copy to edit it here.");
  }

  const options = await db.QuestionOption.findAll({ where: { questionId: question.id }, transaction, lock });
  const submitted = Array.isArray(body?.options) ? body.options : [];
  const byId = new Map(submitted.map((option) => [option?.id, option?.text]));
  if (submitted.length !== options.length || options.length < 2 || !options.every((option) => byId.has(option.id)))
    throw new ApiError(422, "Submit the text for every existing option.");
  if (!byId.has(body.correctOptionId)) throw new ApiError(422, "Choose the correct option.");

  const questionText = editedText(body.questionText);
  const changes = options.map((option) => ({
    option, optionText: editedText(byId.get(option.id)), isCorrect: option.id === body.correctOptionId,
  }));
  await question.update({ questionText, updatedByUserId: user.sub, version: question.version + 1 }, { transaction });
  for (const { option, optionText, isCorrect } of changes) {
    await option.update({ optionText, isCorrect }, { transaction });
  }
});

export const importQuizQuestions = async (id, text, user) => {
  const questions = parseAiken(text);
  return db.sequelize.transaction(async (transaction) => {
    const quiz = await db.Quiz.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!quiz) throw new ApiError(404, "Quiz not found");
    await assertQuizScope(user, quiz);
    if (!["draft", "unpublished"].includes(quiz.status))
      throw new ApiError(409, "Import questions into a draft or unpublished quiz.");
    const scope = { courseId: quiz.courseId, courseTrackId: quiz.courseTrackId, lessonId: quiz.lessonId, topicId: quiz.topicId };
    const writeQuestion = await quizQuestionWriter(quiz, scope, user.sub, transaction);
    let order = await db.QuizQuestion.max("sortOrder", { where: { quizId: id }, transaction }) || 0;
    const publishedAt = new Date();
    for (const entry of questions) {
      const values = validateQuestionDraft({
        ...scope, questionType: "single_choice", questionText: entry.questionText, defaultMarks: 1,
      });
      const { options } = normalizeTypeSpecificData(entry, values.questionType);
      assertPublishable({ ...values, Options: options });
      const questionId = await writeQuestion({
        ...values, status: "published", publishedAt, createdByUserId: user.sub, updatedByUserId: user.sub,
      });
      await db.QuestionOption.bulkCreate(options.map((option) => ({ ...option, questionId })), { transaction });
      await db.QuizQuestion.create({ quizId: id, questionId, marks: 1, sortOrder: ++order }, { transaction });
    }
    return { imported: questions.length };
  });
};

const gradingMethods = ["highest", "latest", "average", "first"], feedbackModes = ["immediate", "after_submission", "after_quiz_closes", "never"];
const safe = (body, fields) => Object.fromEntries(fields.filter((field) => Object.hasOwn(body, field)).map((field) => [field, body[field]]));
const number = (value, field, min, max = Infinity, nullable = true) => { if (value === null || value === undefined || value === "") { if (nullable) return null; throw new ApiError(422, `${field} is required`); } if (!Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max || !Number.isInteger(Number(value))) throw new ApiError(422, `Invalid ${field}`); return Number(value); };
export const trackForActivity = async (activityId) => { const activity = await db.LessonSection.findByPk(activityId); if (!activity || activity.type !== "quiz") throw new ApiError(422, "Quiz must be linked to a Quiz activity"); const lesson = await db.Lesson.findByPk(activity.lessonId); if (!lesson) throw new ApiError(422, "Quiz activity has no valid Lesson"); return { activity, lesson }; };
export const assertQuizScope = async (user, quiz) => {
  const track = await db.CourseTrack.findByPk(quiz.courseTrackId);
  if (!track) throw new ApiError(422, "Medium does not exist");
  if (!privilegedRoles.has(user.role) && !(await hasCourseAssignment(user.sub, {
    courseId: track.courseId, trackId: track.id, capability: "canManageQuizzes",
  }))) throw new ApiError(403, "You cannot manage quizzes in this Medium.");
  return track;
};
const validateSettings = (body, current = {}) => { const values = safe(body, ["title", "description", "instructions", "availableFrom", "availableUntil", "timeLimitMinutes", "attemptsAllowed", "passPercentage", "shuffleQuestions", "shuffleOptions", "questionsPerAttempt", "gradingMethod", "feedbackMode", "showCorrectAnswers", "showScore", "showExplanations", "completionRequiresPass"]); if (values.title !== undefined) { values.title = String(values.title || "").trim().slice(0, 255); if (!values.title) throw new ApiError(422, "Quiz title is required"); } for (const field of ["timeLimitMinutes", "attemptsAllowed", "questionsPerAttempt"]) if (values[field] !== undefined) values[field] = number(values[field], field, 1); if (values.passPercentage !== undefined) { if (!Number.isFinite(Number(values.passPercentage)) || Number(values.passPercentage) < 0 || Number(values.passPercentage) > 100) throw new ApiError(422, "Invalid passPercentage"); values.passPercentage = String(values.passPercentage); } for (const field of ["shuffleQuestions", "shuffleOptions", "showCorrectAnswers", "showScore", "showExplanations", "completionRequiresPass"]) if (values[field] !== undefined) values[field] = values[field] === true; if (values.gradingMethod && !gradingMethods.includes(values.gradingMethod)) throw new ApiError(422, "Invalid gradingMethod"); if (values.feedbackMode && !feedbackModes.includes(values.feedbackMode)) throw new ApiError(422, "Invalid feedbackMode"); const from = values.availableFrom === undefined ? current.availableFrom : values.availableFrom, until = values.availableUntil === undefined ? current.availableUntil : values.availableUntil; if (from && until && new Date(until) <= new Date(from)) throw new ApiError(422, "availableUntil must be after availableFrom"); return values; };
export const loadQuiz = (id, transaction) => db.Quiz.findByPk(id, { transaction });
export const createQuiz = async (body, user) => db.sequelize.transaction(async (transaction) => { const { activity, lesson } = await trackForActivity(body.lessonSectionId); const track = await assertQuizScope(user, { courseTrackId: lesson.trackId }); const values = validateSettings(body); const quiz = await db.Quiz.create({ ...values, lessonSectionId: activity.id, courseId: track.courseId, courseTrackId: lesson.trackId, lessonId: lesson.id, topicId: activity.topicId, title: values.title || activity.title || "Quiz", status: "draft", createdByUserId: user.sub, updatedByUserId: user.sub }, { transaction }); return quiz; });
export const updateQuiz = async (id, body, user) => db.sequelize.transaction(async (transaction) => { const quiz = await loadQuiz(id, transaction); if (!quiz) throw new ApiError(404, "Quiz not found"); await assertQuizScope(user, quiz); if (quiz.status === "archived") throw new ApiError(409, "Archived Quiz cannot be updated"); await quiz.update({ ...validateSettings(body, quiz), updatedByUserId: user.sub }, { transaction }); return quiz; });
export const ruleQuestionWhere = (rule, excludedIds = []) => ({
  id: { [Op.in]: (rule.questionIds || []).filter((id) => !excludedIds.includes(id)) },
  status: "published",
  archivedAt: null,
});
export const matchingCount = (rule, transaction) => db.Question.count({ where: ruleQuestionWhere(rule), transaction });
export const validatePublish = async (quiz, transaction) => { const activity = await db.LessonSection.findByPk(quiz.lessonSectionId, { transaction }); if (!activity || activity.type !== "quiz") throw new ApiError(422, "Quiz must be linked to a valid Quiz activity"); validateSettings(quiz.get({ plain: true }), quiz); const rows = await db.QuizQuestion.findAll({ where: { quizId: quiz.id }, include: [{ model: db.Question, as: "Question" }], transaction }); const rules = await loadRandomRules(quiz.id, transaction); if (!rows.length && !rules.length) throw new ApiError(422, "Add a Question or random selection rule before publishing"); if (rows.some((row) => !row.Question || row.Question.status !== "published" || Number(row.marks) <= 0)) throw new ApiError(422, "All Quiz Questions must be published with positive marks"); for (const rule of rules) if (await matchingCount(rule, transaction) < rule.questionCount) throw new ApiError(422, "A random rule does not have enough published Questions"); const pool = rows.length + (await Promise.all(rules.map((rule) => matchingCount(rule, transaction)))).reduce((total, count) => total + count, 0); if (quiz.questionsPerAttempt && quiz.questionsPerAttempt > pool) throw new ApiError(422, "questionsPerAttempt exceeds the available Question pool"); };
