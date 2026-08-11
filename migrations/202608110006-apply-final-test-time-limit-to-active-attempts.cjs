"use strict";

const { QueryTypes } = require("sequelize");

const quizTitle = "පාඩම 01 — අවසාන පරීක්ෂණය (ප්‍රශ්න 50)";

module.exports = {
  async up(queryInterface) {
    const quiz = (await queryInterface.sequelize.query("SELECT id FROM quizzes WHERE title = ?", { replacements: [quizTitle], type: QueryTypes.SELECT }))[0];
    if (!quiz) return;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await queryInterface.sequelize.query("UPDATE quiz_attempts SET expiresAt = ?, quizSettingsSnapshot = JSON_SET(COALESCE(quizSettingsSnapshot, JSON_OBJECT()), '$.timeLimitMinutes', 60), updatedAt = ? WHERE quizId = ? AND status = 'in_progress'", {
      replacements: [expiresAt, new Date(), quiz.id]
    });
  },

  async down() {}
};
