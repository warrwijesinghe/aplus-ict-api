"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE products
       INNER JOIN course_tracks ON course_tracks.id = products.courseTrackId
       INNER JOIN courses ON courses.id = course_tracks.courseId
       SET products.price = 2200.00,
           products.currency = 'LKR',
           products.updatedAt = NOW()
       WHERE courses.courseGroup = 'OL'
         AND products.lessonId IS NOT NULL
         AND products.productType = 'lesson_exam_success_pack'
         AND products.status IN ('published', 'active')`,
    );
  },

  async down() {
    // A prior published price cannot be recovered safely.
  },
};
