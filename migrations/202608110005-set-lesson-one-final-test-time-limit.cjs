"use strict";

const quizTitle = "පාඩම 01 — අවසාන පරීක්ෂණය (ප්‍රශ්න 50)";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("UPDATE quizzes SET timeLimitMinutes = 60, updatedAt = ? WHERE title = ?", {
      replacements: [new Date(), quizTitle]
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("UPDATE quizzes SET timeLimitMinutes = NULL, updatedAt = ? WHERE title = ?", {
      replacements: [new Date(), quizTitle]
    });
  }
};
