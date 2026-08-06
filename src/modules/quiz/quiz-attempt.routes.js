import { Router } from "express";
import { asyncHandler } from "../../core/errors.js";
import { authenticate } from "../auth/auth.js";
import { audit, requirePermission } from "../../security/authorization.js";
import { PERMISSIONS } from "../../security/permissions.js";
import { attemptResult, getAttempt, gradeEssayAnswer, listAttempts, pendingEssayAnswers, saveAnswer, startAttempt, studentQuizLanding, submitAttempt } from "./quiz-attempt.service.js";

const send = (res, data, status = 200) => res.status(status).json({ data });
export const createQuizAttemptRouter = () => {
  const router = Router();
  router.get("/student/quizzes/:quizId", authenticate, asyncHandler(async (req, res) => send(res, await studentQuizLanding(req.user.sub, req.params.quizId))));
  router.post("/student/quizzes/:quizId/attempts", authenticate, asyncHandler(async (req, res) => send(res, await startAttempt(req.user.sub, req.params.quizId), 201)));
  router.get("/student/quizzes/:quizId/attempts", authenticate, asyncHandler(async (req, res) => send(res, await listAttempts(req.user.sub, req.params.quizId))));
  router.get("/student/quiz-attempts/:attemptId", authenticate, asyncHandler(async (req, res) => send(res, await getAttempt(req.user.sub, req.params.attemptId))));
  router.put("/student/quiz-attempts/:attemptId/answers/:questionId", authenticate, asyncHandler(async (req, res) => send(res, await saveAnswer(req.user.sub, req.params.attemptId, req.params.questionId, req.body))));
  router.post("/student/quiz-attempts/:attemptId/submit", authenticate, asyncHandler(async (req, res) => send(res, await submitAttempt(req.user.sub, req.params.attemptId))));
  router.get("/student/quiz-attempts/:attemptId/result", authenticate, asyncHandler(async (req, res) => send(res, await attemptResult(req.user.sub, req.params.attemptId))));
  router.get("/admin/quiz-grading/pending", authenticate, requirePermission(PERMISSIONS.GRADES_MANAGE), asyncHandler(async (req, res) => send(res, await pendingEssayAnswers(req.user))));
  router.patch("/admin/quiz-grading/answers/:quizAnswerId", authenticate, requirePermission(PERMISSIONS.GRADES_MANAGE), asyncHandler(async (req, res) => { const result = await gradeEssayAnswer(req.user, req.params.quizAnswerId, req.body); await audit(req, "quiz_essay_graded", "quiz_answer", req.params.quizAnswerId, { attemptId: result.attemptId }); send(res, result); }));
  return router;
};
