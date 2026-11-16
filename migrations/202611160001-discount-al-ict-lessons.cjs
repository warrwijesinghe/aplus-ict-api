"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE products p
      JOIN lessons l ON l.id = p.lessonId
      JOIN course_tracks ct ON ct.id = l.trackId
      JOIN courses c ON c.id = ct.courseId
      SET p.price = 4800.00, p.compareAtPrice = 7500.00, p.updatedAt = CURRENT_TIMESTAMP
      WHERE c.slug = 'al-ict'
        AND p.productType = 'lesson_exam_success_pack'
        AND p.currency = 'LKR'
        AND p.status <> 'archived'
    `);
  },
  async down() {
    // Previous prices varied by product. Retain current prices on schema rollback.
  },
};
