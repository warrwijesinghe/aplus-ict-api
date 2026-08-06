import request from "supertest";
import { app } from "../src/app.js";
import { QUIZ_ATTEMPT_STATUSES, QUIZ_GRADING_STATUSES } from "../src/models/quiz-attempt.model.js";

describe("Quiz attempt boundaries", () => {
  it("keeps attempt and grading state in central registries", () => {
    expect(QUIZ_ATTEMPT_STATUSES).toEqual(["in_progress", "submitted", "auto_graded", "pending_manual_grading", "graded", "abandoned", "expired"]);
    expect(QUIZ_GRADING_STATUSES).toContain("pending_manual_grading");
  });

  it("does not expose student attempt or grading routes without authentication", async () => {
    for (const path of ["/api/v1/student/quizzes/example", "/api/v1/student/quizzes/example/attempts", "/api/v1/student/quiz-attempts/example", "/api/v1/student/quiz-attempts/example/result", "/api/v1/admin/quiz-grading/pending"])
      expect((await request(app).get(path)).status).toBe(401);
  });

  it("requires authentication when an answer write is attempted", async () => {
    expect((await request(app).put("/api/v1/student/quiz-attempts/example/answers/question").send({ optionIds: [] })).status).toBe(401);
  });
});
