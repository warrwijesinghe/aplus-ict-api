import { loadRandomRules } from "./quiz-schema.js";
import { Router } from "express";
import { authenticate } from "../auth/auth.js";
import { ApiError, asyncHandler } from "../../core/errors.js";
import { audit, hasCourseAssignment, privilegedRoles, requirePermission } from "../../security/authorization.js";
import { PERMISSIONS } from "../../security/permissions.js";
import { db } from "../../models/index.js";
import { assertQuizScope, createQuiz, editQuizQuestion, importQuizQuestions, loadQuiz, matchingCount, updateQuiz, validatePublish } from "./quiz.service.js";
import { serializeQuiz, serializeQuizQuestion, serializeRule } from "./quiz.serializer.js";
const send = (res, data, status = 200) => res.status(status).json({ data }); const read = [authenticate, requirePermission(PERMISSIONS.QUIZZES_READ)], create = [authenticate, requirePermission(PERMISSIONS.QUIZZES_CREATE)], update = [authenticate, requirePermission(PERMISSIONS.QUIZZES_UPDATE)], publish = [authenticate, requirePermission(PERMISSIONS.QUIZZES_PUBLISH)];
const adminQuestionInclude = [{ model: db.Question, as: "Question", include: [{ model: db.QuestionOption, as: "Options" }] }];
const quiz = async (req) => { const row = await loadQuiz(req.params.id); if (!row) throw new ApiError(404, "Quiz not found"); await assertQuizScope(req.user, row); return row; };
export const createQuizRouter = () => { const router = Router();
  router.get("/admin/quizzes", ...read, asyncHandler(async (req, res) => { if (!req.query.lessonSectionId) throw new ApiError(422, "lessonSectionId is required"); const row = await db.Quiz.findOne({ where: { lessonSectionId: req.query.lessonSectionId } }); if (!row) return send(res, null); await assertQuizScope(req.user, row); send(res, serializeQuiz(row)); }));
  router.post("/admin/quizzes", ...create, asyncHandler(async (req, res) => { const row = await createQuiz(req.body, req.user); await audit(req, "quiz_created", "quiz", row.id); send(res, serializeQuiz(row), 201); }));
  router.get("/admin/quizzes/:id", ...read, asyncHandler(async (req, res) => send(res, serializeQuiz(await quiz(req)))));
  router.patch("/admin/quizzes/:id", ...update, asyncHandler(async (req, res) => { const row = await updateQuiz(req.params.id, req.body, req.user); await audit(req, "quiz_updated", "quiz", row.id); send(res, serializeQuiz(row)); }));
  router.post("/admin/quizzes/:id/import-aiken", ...update,
    asyncHandler(async (req, res) => {
      const result = await importQuizQuestions(req.params.id, req.body?.text, req.user);
      await audit(req, "quiz_questions_imported", "quiz", req.params.id, result);
      send(res, result, 201);
    }));
  router.post("/admin/quizzes/:id/publish", ...publish, requirePermission(PERMISSIONS.ACTIVITIES_PUBLISH), asyncHandler(async (req, res) => {
    const row = await db.sequelize.transaction(async (transaction) => {
      const current = await db.Quiz.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!current) throw new ApiError(404, "Quiz not found");
      await assertQuizScope(req.user, current);
      if (!privilegedRoles.has(req.user.role) && !(await hasCourseAssignment(req.user.sub, {
        courseId: current.courseId, trackId: current.courseTrackId, capability: "canManageContent",
      }))) throw new ApiError(403, "You cannot publish content in this Medium.");
      const activity = await db.LessonSection.findByPk(current.lessonSectionId, { transaction, lock: transaction.LOCK.UPDATE });
      if (current.status === "archived" || activity?.status === "archived")
        throw new ApiError(409, "Archived quizzes or activities cannot be published.");
      await validatePublish(current, transaction);
      const publishedAt = new Date();
      await current.update({ status: "published", publishedAt, archivedAt: null, updatedByUserId: req.user.sub }, { transaction });
      if (activity.status !== "published") await activity.update({ status: "published", publishedAt, isVisible: true }, { transaction });
      return current;
    });
    await audit(req, "quiz_published", "quiz", row.id);
    send(res, serializeQuiz(row));
  }));
  for (const [action, middleware] of [["unpublish", publish], ["archive", update]]) router.post(`/admin/quizzes/:id/${action}`, ...middleware, asyncHandler(async (req, res) => {
    const row = await quiz(req);
    if (action === "unpublish") await row.update({ status: "unpublished", updatedByUserId: req.user.sub });
    else await row.update({ status: "archived", archivedAt: new Date(), updatedByUserId: req.user.sub });
    await audit(req, `quiz_${action}ed`, "quiz", row.id);
    send(res, serializeQuiz(row));
  }));
  router.get("/admin/quizzes/:id/questions", ...read, asyncHandler(async (req, res) => { await quiz(req); const rows = await db.QuizQuestion.findAll({ where: { quizId: req.params.id }, include: adminQuestionInclude, order: [["sortOrder", "ASC"]] }); send(res, { items: rows.map(serializeQuizQuestion), totalMarks: rows.reduce((sum, row) => sum + Number(row.marks), 0) }); }));
  router.patch("/admin/quizzes/:id/questions/:quizQuestionId/content", ...update, asyncHandler(async (req, res) => {
    await editQuizQuestion(req.params.id, req.params.quizQuestionId, req.body, req.user);
    await audit(req, "quiz_question_content_updated", "quiz", req.params.id, { quizQuestionId: req.params.quizQuestionId });
    send(res, { saved: true });
  }));
  router.patch("/admin/quizzes/:id/questions/:quizQuestionId", ...update, asyncHandler(async (req, res) => { await quiz(req); const row = await db.QuizQuestion.findOne({ where: { id: req.params.quizQuestionId, quizId: req.params.id } }); if (!row) throw new ApiError(404, "Quiz Question not found"); if (!Number.isFinite(Number(req.body.marks)) || Number(req.body.marks) <= 0) throw new ApiError(422, "marks must be positive"); await row.update({ marks: String(req.body.marks), ...(Object.hasOwn(req.body, "isRequired") ? { isRequired: req.body.isRequired === true } : {}) }); await audit(req, "quiz_question_updated", "quiz", req.params.id); send(res, serializeQuizQuestion(row)); }));
  router.delete("/admin/quizzes/:id/questions/:quizQuestionId", ...update, asyncHandler(async (req, res) => { await quiz(req); const count = await db.QuizQuestion.destroy({ where: { id: req.params.quizQuestionId, quizId: req.params.id } }); if (!count) throw new ApiError(404, "Quiz Question not found"); await audit(req, "quiz_question_removed", "quiz", req.params.id); send(res, { removed: true }); }));
  router.post("/admin/quizzes/:id/questions/reorder", ...update, asyncHandler(async (req, res) => { await db.sequelize.transaction(async (transaction) => { await quiz(req); const rows = await db.QuizQuestion.findAll({ where: { quizId: req.params.id }, transaction }); const ids = req.body.orderedIds; if (!Array.isArray(ids) || ids.length !== rows.length || new Set(ids).size !== ids.length || rows.some((row) => !ids.includes(row.id))) throw new ApiError(422, "orderedIds must include every Quiz Question once"); await Promise.all(ids.map((id, index) => db.QuizQuestion.update({ sortOrder: index + 1 }, { where: { id }, transaction }))); }); await audit(req, "quiz_questions_reordered", "quiz", req.params.id); send(res, { orderedIds: req.body.orderedIds }); }));
  router.get("/admin/quizzes/:id/random-rules", ...read, asyncHandler(async (req, res) => { const row = await quiz(req); const rules = await loadRandomRules(row.id); send(res, await Promise.all(rules.map(async (rule) => serializeRule(rule, await matchingCount(rule))))); }));
  router.delete("/admin/quizzes/:id/random-rules/:ruleId", ...update, asyncHandler(async (req, res) => { await quiz(req); const count = await db.QuizRandomRule.destroy({ where: { id: req.params.ruleId, quizId: req.params.id } }); if (!count) throw new ApiError(404, "Random rule not found"); send(res, { removed: true }); }));
  router.get("/admin/quizzes/:id/preview", ...read, asyncHandler(async (req, res) => { const row = await quiz(req), questions = await db.QuizQuestion.findAll({ where: { quizId: row.id }, include: adminQuestionInclude, order: [["sortOrder", "ASC"]] }); send(res, { quiz: serializeQuiz(row), questions: questions.map(serializeQuizQuestion), totalMarks: questions.reduce((sum, item) => sum + Number(item.marks), 0) }); }));
  return router;
};
