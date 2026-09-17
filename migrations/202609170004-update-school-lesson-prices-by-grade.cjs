"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `UPDATE products
       INNER JOIN course_tracks ON course_tracks.id = products.courseTrackId
       INNER JOIN courses ON courses.id = course_tracks.courseId
       INNER JOIN academic_levels ON academic_levels.id = courses.academicLevelId
       SET products.price = CASE academic_levels.code
         WHEN 'GRADE_6' THEN 1400.00
         WHEN 'GRADE_7' THEN 1500.00
         WHEN 'GRADE_8' THEN 1600.00
         WHEN 'GRADE_9' THEN 1700.00
         ELSE products.price
       END,
       products.currency = 'LKR',
       products.updatedAt = NOW()
       WHERE academic_levels.code IN ('GRADE_6', 'GRADE_7', 'GRADE_8', 'GRADE_9')
         AND products.lessonId IS NOT NULL
         AND products.productType = 'lesson_exam_success_pack'
         AND products.status IN ('published', 'active')`,
    );
  },

  async down() {
    // Prior published values cannot be recovered safely.
  },
};
