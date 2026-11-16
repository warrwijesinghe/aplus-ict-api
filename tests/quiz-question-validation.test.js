import request from "supertest";
import { app } from "../src/app.js";
import { ApiError } from "../src/core/errors.js";
import { Op } from "sequelize";
import { ruleQuestionWhere } from "../src/modules/quiz/quiz.service.js";
import { QUESTION_TYPES } from "../src/modules/quiz/question-type-registry.js";
import { assertPublishable, normalizeTypeSpecificData, validateQuestionDraft } from "../src/modules/quiz/question-validator.js";

const base = { questionText: "<p>What is ICT?</p>", defaultMarks: 1, questionType: "single_choice" };
describe("Quiz question validation and retired endpoints", () => {
  it("has a controlled registry for all supported question types", () => {
    expect(Object.keys(QUESTION_TYPES)).toEqual(["single_choice", "multiple_choice", "true_false", "short_answer", "numeric", "matching", "ordering", "essay"]);
    expect(QUESTION_TYPES.essay.manualGrading).toBe(true);
  });
  it("sanitizes draft content and rejects invalid marks or types", () => {
    expect(validateQuestionDraft({ ...base, questionText: "<script>x</script><p>Safe</p>" }).questionText).toBe("<p>Safe</p>");
    expect(() => validateQuestionDraft({ ...base, defaultMarks: 0 })).toThrow(ApiError);
    expect(() => validateQuestionDraft({ ...base, questionType: "unknown" })).toThrow("Unsupported questionType");
    expect(validateQuestionDraft({ ...base, correctFeedback: "", incorrectFeedback: "" })).toMatchObject({ correctFeedback: null, incorrectFeedback: null });
    expect(validateQuestionDraft({ ...base, lessonId: "", topicId: "" })).toMatchObject({ lessonId: null, topicId: null });
  });
  it("enforces publish-time option and ordering rules", () => {
    expect(() => assertPublishable({ ...base, Options: [{ optionText: "A", isCorrect: false, sortOrder: 1 }, { optionText: "B", isCorrect: false, sortOrder: 2 }] })).toThrow("Exactly one correct option");
    expect(() => assertPublishable({ ...base, questionType: "ordering", OrderingItems: [{ itemText: "A", correctPosition: 1 }, { itemText: "B", correctPosition: 1 }] })).toThrow("Ordering requires unique");
    expect(() => assertPublishable({ ...base, Options: [{ optionText: "A", isCorrect: true, sortOrder: 1 }, { optionText: "B", isCorrect: false, sortOrder: 2 }] })).not.toThrow();
  });
  it("persists type-specific request data as normalized child records", () => {
    expect(normalizeTypeSpecificData({ matchingPairs: [{ promptText: "CPU", matchText: "Processor" }, { promptText: "RAM", matchText: "Memory" }] }, "matching").matchingPairs).toHaveLength(2);
    expect(normalizeTypeSpecificData({ numericAnswer: { answerValue: "42", toleranceValue: "0.5" } }, "numeric").numericAnswer).toMatchObject({ answerValue: "42", toleranceType: "absolute" });
  });
  it("no longer exposes standalone question management routes", async () => {
    for (const path of ["/api/v1/admin/question-bank/metadata", "/api/v1/admin/question-categories", "/api/v1/admin/questions", "/api/v1/admin/quizzes/quiz-id/candidate-questions"])
      expect((await request(app).get(path)).status).toBe(404);
  });
  it("limits existing random rules to their migrated candidates", () => {
    expect(ruleQuestionWhere({ questionIds: ["included", "already-selected"] }, ["already-selected"])).toEqual({
      id: { [Op.in]: ["included"] }, status: "published", archivedAt: null,
    });
    expect(ruleQuestionWhere({ questionIds: [] }).id[Op.in]).toEqual([]);
  });
});
