"use strict";

const { QueryTypes } = require("sequelize");

const quizTitle = "පාඩම 01 — අවසාන පරීක්ෂණය (ප්‍රශ්න 50)";

module.exports = {
  async up(queryInterface) {
    const database = queryInterface.sequelize;
    await database.transaction(async (transaction) => {
      const quiz = (await database.query("SELECT id FROM quizzes WHERE title = ?", {
        replacements: [quizTitle], type: QueryTypes.SELECT, transaction
      }))[0];
      if (!quiz) return;
      const extras = await database.query("SELECT questionId FROM quiz_questions WHERE quizId = ? AND sortOrder > 50", {
        replacements: [quiz.id], type: QueryTypes.SELECT, transaction
      });
      const questionIds = extras.map((row) => row.questionId);
      if (!questionIds.length) return;
      await queryInterface.bulkDelete("quiz_questions", { quizId: quiz.id, questionId: questionIds }, { transaction });
      await queryInterface.bulkDelete("question_options", { questionId: questionIds }, { transaction });
      await queryInterface.bulkDelete("questions", { id: questionIds }, { transaction });
    });
  },

  async down() {}
};
