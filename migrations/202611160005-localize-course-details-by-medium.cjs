"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tracks = await queryInterface.describeTable("course_tracks");
    if (!tracks.description) await queryInterface.addColumn("course_tracks", "description", { type: Sequelize.TEXT });
    await queryInterface.sequelize.query(`
      UPDATE course_tracks t
      JOIN courses c ON c.id = t.courseId
      LEFT JOIN media m ON m.id = t.mediumId
      SET t.title = CASE
        WHEN m.code IN ('si', 'sinhala') AND NULLIF(c.titleSi, '') IS NOT NULL
          AND (t.title = c.title OR t.title = c.titleEn OR t.title = CONCAT(c.titleEn, ' - ', m.name) OR t.title = CONCAT(c.titleEn, ' - Sinhala Medium'))
          THEN c.titleSi
        ELSE t.title
      END,
      t.description = CASE
        WHEN m.code IN ('si', 'sinhala') THEN COALESCE(NULLIF(c.shortDescriptionSi, ''), NULLIF(c.shortDescriptionEn, ''), c.description)
        ELSE COALESCE(NULLIF(c.shortDescriptionEn, ''), c.description)
      END
      WHERE t.description IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE courses SET title = COALESCE(NULLIF(titleEn, ''), NULLIF(title, ''), titleSi),
        description = COALESCE(NULLIF(description, ''), NULLIF(shortDescriptionEn, ''), shortDescriptionSi)
    `);
    await queryInterface.sequelize.query("ALTER TABLE courses DROP COLUMN titleEn, DROP COLUMN titleSi, DROP COLUMN shortDescriptionEn, DROP COLUMN shortDescriptionSi");
  },
  async down(queryInterface, Sequelize) {
    for (const [field, type] of Object.entries({ titleEn: Sequelize.STRING, titleSi: Sequelize.STRING, shortDescriptionEn: Sequelize.TEXT, shortDescriptionSi: Sequelize.TEXT }))
      await queryInterface.addColumn("courses", field, { type });
    await queryInterface.sequelize.query("UPDATE courses SET titleEn = title, shortDescriptionEn = description");
    // Keep medium descriptions so rolling back does not erase edits.
  },
};
