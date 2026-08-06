import { ApiError } from "../../core/errors.js";

const define = (key, values) => [key, Object.freeze({ key, label: key.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase()), automaticGrading: true, manualGrading: false, minimumItems: 0, ...values })];
export const QUESTION_TYPES = Object.freeze(Object.fromEntries([
  define("single_choice", { description: "Select one answer", answerModel: "options", minimumItems: 2 }),
  define("multiple_choice", { description: "Select one or more answers", answerModel: "options", minimumItems: 2 }),
  define("true_false", { description: "Select true or false", answerModel: "options", minimumItems: 2 }),
  define("short_answer", { description: "A short textual answer", answerModel: "accepted_answers" }),
  define("numeric", { description: "A numeric answer with a safe tolerance", answerModel: "numeric_answer" }),
  define("matching", { description: "Match prompts to answers", answerModel: "matching_pairs", minimumItems: 2 }),
  define("ordering", { description: "Put items in order", answerModel: "ordering_items", minimumItems: 2 }),
  define("essay", { description: "A manually graded written response", answerModel: "essay_config", automaticGrading: false, manualGrading: true }),
]));
export const QUESTION_DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);
export const QUESTION_STATUSES = Object.freeze(["draft", "published", "unpublished", "archived"]);
export const getQuestionType = (key) => {
  const type = QUESTION_TYPES[key];
  if (!type) throw new ApiError(422, "Unsupported questionType");
  return type;
};
export const questionTypeMetadata = () => Object.values(QUESTION_TYPES).map((type) => ({ ...type }));
