import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { db } from "../../models/index.js";
import { ApiError } from "../../core/errors.js";

// Support deployments where the API is updated before the Question Bank migration.
export const loadRandomRules = async (quizId, transaction) => {
  const rules = await db.sequelize.query(
    "SELECT * FROM quiz_random_rules WHERE quizId = :quizId ORDER BY sortOrder",
    { replacements: { quizId }, type: QueryTypes.SELECT, transaction },
  );
  for (const rule of rules) {
    if (rule.questionIds != null) {
      if (typeof rule.questionIds === "string") rule.questionIds = JSON.parse(rule.questionIds);
      continue;
    }
    const candidates = await db.sequelize.query(`
      SELECT q.id
      FROM quiz_random_rules r
      JOIN quizzes z ON z.id = r.quizId
      JOIN questions q ON q.courseId = z.courseId AND q.courseTrackId = z.courseTrackId
      WHERE r.id = :ruleId AND q.status = 'published' AND q.archivedAt IS NULL
        AND (r.questionCategoryId IS NULL OR q.questionCategoryId = r.questionCategoryId)
        AND (r.lessonId IS NULL OR q.lessonId = r.lessonId)
        AND (r.topicId IS NULL OR q.topicId = r.topicId)
        AND (r.questionType IS NULL OR q.questionType = r.questionType)
        AND (r.difficulty IS NULL OR q.difficulty = r.difficulty)
        AND (r.tagId IS NULL OR EXISTS (
          SELECT 1 FROM question_tag_assignments t WHERE t.questionId = q.id AND t.questionTagId = r.tagId
        ))
    `, { replacements: { ruleId: rule.id }, type: QueryTypes.SELECT, transaction });
    rule.questionIds = candidates.map(({ id }) => id);
  }
  return rules;
};

export const quizQuestionWriter = async (quiz, scope, userId, transaction) => {
  const query = db.sequelize.getQueryInterface();
  const columns = await query.describeTable("questions", { transaction });
  if (!columns.questionCategoryId)
    return async (values) => (await db.Question.create(values, { transaction })).id;

  const slug = `quiz-import-${quiz.id}`;
  const [category] = await db.sequelize.query(
    "SELECT id, status FROM question_categories WHERE courseTrackId = :trackId AND slug = :slug",
    { replacements: { trackId: quiz.courseTrackId, slug }, type: QueryTypes.SELECT, transaction },
  );
  if (category?.status === "archived") throw new ApiError(409, "The quiz’s import category is archived.");
  const categoryId = category?.id || randomUUID();
  const now = new Date();
  if (!category) await query.bulkInsert("question_categories", [{
    ...scope, id: categoryId, slug, name: "Imported quiz questions", status: "published",
    createdByUserId: userId, createdAt: now, updatedAt: now,
  }], { transaction });

  return async (values) => {
    const id = randomUUID();
    await query.bulkInsert("questions", [{
      ...values, id, questionCategoryId: categoryId, createdAt: now, updatedAt: now,
    }], { transaction });
    return id;
  };
};
