import { ApiError } from "../../core/errors.js";
import { sanitizeEducationalHtml } from "../content/activities/html-sanitizer.js";
import { getQuestionType, QUESTION_DIFFICULTIES } from "./question-type-registry.js";

const has = (object, key) => Object.hasOwn(object, key);
const cleanHtml = (value, field) => { if (value === null) return null; const clean = sanitizeEducationalHtml(value); if (clean !== null && !String(clean).replace(/<[^>]*>/g, "").trim()) throw new ApiError(422, `${field} must not be empty`); return clean; };
const decimal = (value, field, { min = null } = {}) => { if (value === null || value === undefined || value === "") return null; if (!/^[-+]?\d+(?:\.\d+)?$/.test(String(value))) throw new ApiError(422, `${field} must be a decimal number`); const number = Number(value); if (min !== null && number < min) throw new ApiError(422, `${field} must be at least ${min}`); return String(value); };
export const validateQuestionDraft = (body, current = {}) => {
  const values = {};
  for (const field of ["questionCategoryId", "courseId", "courseTrackId", "lessonId", "topicId", "title", "questionTextFormat", "difficulty", "negativeMarks", "defaultMarks"]) if (has(body, field)) values[field] = body[field];
  if (has(body, "questionType")) { getQuestionType(body.questionType); values.questionType = body.questionType; }
  if (has(body, "difficulty") && !QUESTION_DIFFICULTIES.includes(body.difficulty)) throw new ApiError(422, "Invalid difficulty");
  if (has(body, "defaultMarks")) values.defaultMarks = decimal(body.defaultMarks, "defaultMarks", { min: 0.01 });
  if (has(body, "negativeMarks")) values.negativeMarks = decimal(body.negativeMarks, "negativeMarks", { min: 0 });
  if (has(body, "title")) { values.title = body.title === null ? null : String(body.title).trim().slice(0, 255); }
  if (has(body, "questionText")) values.questionText = cleanHtml(body.questionText, "questionText");
  for (const field of ["generalFeedback", "correctFeedback", "incorrectFeedback", "explanation"]) if (has(body, field)) values[field] = body[field] ? cleanHtml(body[field], field) : null;
  if (values.questionText === null) throw new ApiError(422, "questionText must not be empty");
  if ((values.negativeMarks ?? current.negativeMarks) !== null && Number(values.negativeMarks ?? current.negativeMarks) > Number(values.defaultMarks ?? current.defaultMarks)) throw new ApiError(422, "negativeMarks cannot exceed defaultMarks");
  return values;
};
const list = (data, name) => { const result = data?.[name]; if (result === undefined) return undefined; if (!Array.isArray(result)) throw new ApiError(422, `${name} must be an array`); return result; };
const text = (value, field) => { const clean = cleanHtml(value, field); if (!clean) throw new ApiError(422, `${field} is required`); return clean; };
export const normalizeTypeSpecificData = (data, typeKey) => {
  const type = getQuestionType(typeKey); const result = {};
  if (type.answerModel === "options") { const entries = list(data, "options"); if (entries !== undefined) result.options = entries.map((item, index) => ({ optionText: text(item.optionText, "optionText"), optionTextFormat: item.optionTextFormat || "html", isCorrect: item.isCorrect === true, feedback: item.feedback ? cleanHtml(item.feedback, "feedback") : null, sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index + 1 })); }
  if (type.answerModel === "accepted_answers") { const entries = list(data, "acceptedAnswers"); if (entries !== undefined) result.acceptedAnswers = entries.map((item, index) => ({ answerText: String(item.answerText || "").trim(), isCaseSensitive: item.isCaseSensitive === true, matchMode: ["exact", "normalized"].includes(item.matchMode) ? item.matchMode : "normalized", weight: decimal(item.weight ?? 1, "weight", { min: 0.01 }), feedback: item.feedback ? cleanHtml(item.feedback, "feedback") : null, sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index + 1 })); }
  if (type.answerModel === "numeric_answer" && data?.numericAnswer !== undefined) { const item = data.numericAnswer || {}; const toleranceType = item.toleranceType || "absolute"; if (!["absolute", "range"].includes(toleranceType)) throw new ApiError(422, "Invalid toleranceType"); result.numericAnswer = { answerValue: decimal(item.answerValue, "answerValue"), toleranceType, toleranceValue: decimal(item.toleranceValue ?? 0, "toleranceValue", { min: 0 }), minimumValue: decimal(item.minimumValue, "minimumValue"), maximumValue: decimal(item.maximumValue, "maximumValue"), unit: item.unit ? String(item.unit).trim().slice(0, 100) : null, feedback: item.feedback ? cleanHtml(item.feedback, "feedback") : null }; if (result.numericAnswer.answerValue === null || (toleranceType === "range" && (result.numericAnswer.minimumValue === null || result.numericAnswer.maximumValue === null || Number(result.numericAnswer.minimumValue) > Number(result.numericAnswer.maximumValue)))) throw new ApiError(422, "Invalid numeric answer range"); }
  if (type.answerModel === "matching_pairs") { const entries = list(data, "matchingPairs"); if (entries !== undefined) result.matchingPairs = entries.map((item, index) => ({ promptText: text(item.promptText, "promptText"), matchText: text(item.matchText, "matchText"), feedback: item.feedback ? cleanHtml(item.feedback, "feedback") : null, sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index + 1 })); }
  if (type.answerModel === "ordering_items") { const entries = list(data, "orderingItems"); if (entries !== undefined) result.orderingItems = entries.map((item, index) => ({ itemText: text(item.itemText, "itemText"), correctPosition: Number(item.correctPosition), feedback: item.feedback ? cleanHtml(item.feedback, "feedback") : null, sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : index + 1 })); }
  if (type.answerModel === "essay_config" && data?.essayConfig !== undefined) { const item = data.essayConfig || {}; const minimumWords = item.minimumWords === null || item.minimumWords === undefined ? null : Number(item.minimumWords); const maximumWords = item.maximumWords === null || item.maximumWords === undefined ? null : Number(item.maximumWords); if (![minimumWords, maximumWords].every((x) => x === null || (Number.isInteger(x) && x >= 0)) || (minimumWords !== null && maximumWords !== null && minimumWords > maximumWords)) throw new ApiError(422, "Invalid essay word limits"); result.essayConfig = { minimumWords, maximumWords, responseFormat: ["plain_text", "rich_text"].includes(item.responseFormat) ? item.responseFormat : "rich_text", gradingGuide: item.gradingGuide ? cleanHtml(item.gradingGuide, "gradingGuide") : null, modelAnswer: item.modelAnswer ? cleanHtml(item.modelAnswer, "modelAnswer") : null }; }
  return result;
};
export const assertPublishable = (question) => {
  if (!String(question.questionText || "").replace(/<[^>]*>/g, "").trim()) throw new ApiError(422, "Question text is required before publishing");
  if (Number(question.defaultMarks) <= 0) throw new ApiError(422, "Positive marks are required before publishing");
  const type = getQuestionType(question.questionType), options = question.Options || [];
  if (["single_choice", "multiple_choice", "true_false"].includes(type.key)) { if (options.length < 2) throw new ApiError(422, "At least two options are required"); const correct = options.filter((item) => item.isCorrect); if ((type.key === "single_choice" || type.key === "true_false") && correct.length !== 1) throw new ApiError(422, "Exactly one correct option is required"); if (type.key === "multiple_choice" && !correct.length) throw new ApiError(422, "At least one correct option is required"); if (new Set(options.map((item) => item.sortOrder)).size !== options.length) throw new ApiError(422, "Option sort orders must be unique"); }
  if (type.key === "short_answer" && !(question.AcceptedAnswers || []).length) throw new ApiError(422, "At least one accepted answer is required");
  if (type.key === "numeric" && !question.NumericAnswer) throw new ApiError(422, "A numeric answer is required");
  if (type.key === "matching" && (question.MatchingPairs || []).length < 2) throw new ApiError(422, "At least two matching pairs are required");
  if (type.key === "ordering") { const items = question.OrderingItems || []; if (items.length < 2 || new Set(items.map((item) => item.correctPosition)).size !== items.length || items.some((item) => !Number.isInteger(item.correctPosition) || item.correctPosition < 1)) throw new ApiError(422, "Ordering requires unique valid positions"); }
  if (type.key === "essay" && !type.manualGrading) throw new ApiError(422, "Essay requires manual grading");
};
