"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE products
       INNER JOIN course_tracks ON course_tracks.id = products.courseTrackId
       INNER JOIN courses ON courses.id = course_tracks.courseId
       INNER JOIN academic_levels ON academic_levels.id = courses.academicLevelId
       SET products.price = CASE
         WHEN academic_levels.code IN ('GRADE_6', 'GRADE_7') THEN 1500.00
         WHEN academic_levels.code IN ('GRADE_8', 'GRADE_9') THEN 1800.00
         WHEN courses.courseGroup = 'OL' THEN 2000.00
         WHEN courses.courseGroup = 'AL' THEN 2800.00
         ELSE products.price
       END,
       products.currency = 'LKR',
       products.updatedAt = NOW()
       WHERE products.lessonId IS NOT NULL
         AND products.productType = 'lesson_exam_success_pack'
         AND products.status IN ('published', 'active')`,
    );
  },

  async down() {
    // These are the requested published catalogue prices. The previous values
    // cannot be inferred safely during a rollback.
  },
};
