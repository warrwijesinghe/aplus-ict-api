"use strict";

async function removeColumn(query, table, column) {
  if (!(await query.describeTable(table))[column]) return;
  const references = await query.getForeignKeyReferencesForTable(table);
  for (const reference of references.filter((entry) => entry.columnName === column)) {
    await query.removeConstraint(table, reference.constraintName);
  }
  await query.removeColumn(table, column);
}

module.exports = {
  async up(query, Sequelize) {
    const database = query.sequelize;
    if (!(await query.describeTable("quiz_random_rules")).questionIds)
      await query.addColumn("quiz_random_rules", "questionIds", { type: Sequelize.JSON });

    await database.transaction(async (transaction) => {
      const rules = await database.query(
        "SELECT id FROM quiz_random_rules WHERE questionIds IS NULL",
        { type: Sequelize.QueryTypes.SELECT, transaction },
      );
      for (const rule of rules) {
        const candidates = await database.query(`
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
          ORDER BY q.id
        `, { replacements: { ruleId: rule.id }, type: Sequelize.QueryTypes.SELECT, transaction });
        await database.query("UPDATE quiz_random_rules SET questionIds = :ids WHERE id = :ruleId", {
          replacements: { ids: JSON.stringify(candidates.map(({ id }) => id)), ruleId: rule.id }, transaction,
        });
      }

      const bankOnly = `
        NOT EXISTS (SELECT 1 FROM quiz_questions x WHERE x.questionId = q.id)
        AND NOT EXISTS (SELECT 1 FROM quiz_attempt_questions x WHERE x.questionId = q.id)
        AND NOT EXISTS (SELECT 1 FROM quiz_answers x WHERE x.questionId = q.id)
        AND NOT EXISTS (SELECT 1 FROM quiz_random_rules r WHERE JSON_CONTAINS(r.questionIds, JSON_QUOTE(q.id)) = 1)
      `;
      await database.query(`DELETE l FROM resource_links l JOIN questions q ON q.id = l.entityId
        WHERE l.entityType = 'question' AND ${bankOnly}`, { transaction });
      await database.query(`DELETE q FROM questions q WHERE ${bankOnly}`, { transaction });
      const bankPermissions = "p.code LIKE 'questions.%' OR p.code LIKE 'question_categories.%'";
      await database.query(`DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permissionId
        WHERE ${bankPermissions}`, { transaction });
      await database.query(`DELETE p FROM permissions p WHERE ${bankPermissions}`, { transaction });
    });

    for (const column of ["questionCategoryId", "tagId", "lessonId", "topicId", "questionType", "difficulty"])
      await removeColumn(query, "quiz_random_rules", column);
    await removeColumn(query, "questions", "questionCategoryId");
    await removeColumn(query, "educator_assignments", "canManageQuestions");
    await query.dropTable("question_tag_assignments");
    await query.dropTable("question_tags");
    await query.dropTable("question_categories");
  },

  async down() {
    throw new Error("Restore the pre-migration database backup to recover removed Question Bank data.");
  },
};
