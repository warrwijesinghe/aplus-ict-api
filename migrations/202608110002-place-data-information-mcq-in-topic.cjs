"use strict";

const { QueryTypes } = require("sequelize");

const quizTitle = "දත්ත සහ තොරතුරු — බහුවරණ ප්‍රශ්නාවලිය";

module.exports = {
  async up(queryInterface) {
    const database = queryInterface.sequelize;
    await database.transaction(async (transaction) => {
      const one = async (sql, replacements) => (await database.query(sql, {
        replacements,
        type: QueryTypes.SELECT,
        transaction
      }))[0];
      const track = await one("SELECT id FROM course_tracks WHERE slug = ?", ["al-ict-sinhala"]);
      const lesson = track && await one("SELECT id FROM lessons WHERE trackId = ? AND lessonNumber = 1", [track.id]);
      const topic = lesson && await one("SELECT id FROM topics WHERE lessonId = ? AND titleEn = ?", [lesson.id, "Data and Information"]);
      const activity = lesson && await one("SELECT id FROM lesson_sections WHERE lessonId = ? AND type = 'quiz' AND titleSi = ?", [lesson.id, quizTitle]);
      if (!topic || !activity) return;

      const order = await one("SELECT COALESCE(MAX(sortOrder), 0) AS maxOrder FROM lesson_sections WHERE topicId = ?", [topic.id]);
      await database.query("UPDATE lesson_sections SET topicId = ?, sortOrder = ? WHERE id = ?", {
        replacements: [topic.id, Number(order.maxOrder) + 1, activity.id],
        transaction
      });
      await database.query("UPDATE quizzes SET topicId = ? WHERE lessonSectionId = ?", {
        replacements: [topic.id, activity.id],
        transaction
      });
    });
  },

  async down(queryInterface) {
    const database = queryInterface.sequelize;
    await database.transaction(async (transaction) => {
      const rows = await database.query("SELECT id FROM lesson_sections WHERE type = 'quiz' AND titleSi = ?", {
        replacements: [quizTitle],
        type: QueryTypes.SELECT,
        transaction
      });
      for (const activity of rows) {
        await database.query("UPDATE lesson_sections SET topicId = NULL WHERE id = ?", { replacements: [activity.id], transaction });
        await database.query("UPDATE quizzes SET topicId = NULL WHERE lessonSectionId = ?", { replacements: [activity.id], transaction });
      }
    });
  }
};
