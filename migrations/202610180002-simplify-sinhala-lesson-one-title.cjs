"use strict";

const previousTitle = "Lesson 01 — Concept of ICT — තොරතුරු හා සන්නිවේදන තාක්ෂණ සංකල්ප";
const title = "තොරතුරු හා සන්නිවේදන තාක්ෂණ සංකල්ප";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE lessons l INNER JOIN course_tracks t ON t.id = l.trackId SET l.title = :title WHERE t.slug = 'al-ict-sinhala' AND l.slug = 'concept-of-ict' AND l.title = :previousTitle",
      { replacements: { title, previousTitle } },
    );
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE lessons l INNER JOIN course_tracks t ON t.id = l.trackId SET l.title = :previousTitle WHERE t.slug = 'al-ict-sinhala' AND l.slug = 'concept-of-ict' AND l.title = :title",
      { replacements: { title, previousTitle } },
    );
  },
};
