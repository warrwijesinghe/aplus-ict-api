"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE lessons
       INNER JOIN course_tracks ON course_tracks.id = lessons.trackId
       SET lessons.summary = CASE
         WHEN course_tracks.slug LIKE '%sinhala%' THEN CONCAT(
           lessons.title,
           ' පිළිබඳ මූලික සංකල්ප සහ ප්‍රායෝගික කුසලතා ඉගෙන ගන්න.'
         )
         ELSE CONCAT(
           'Explore the key concepts and practical skills in ',
           lessons.title,
           '.'
         )
       END,
       lessons.updatedAt = NOW()
       WHERE lessons.summary IS NULL OR TRIM(lessons.summary) = ''`,
    );
  },

  async down() {
    // The generated descriptions are published catalogue copy and are not
    // removed automatically to avoid erasing later editorial updates.
  },
};
