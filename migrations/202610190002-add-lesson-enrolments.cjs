"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lesson_enrolments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
      courseTrackId: { type: Sequelize.UUID, allowNull: false, references: { model: 'course_tracks', key: 'id' } },
      lessonId: { type: Sequelize.UUID, allowNull: false, references: { model: 'lessons', key: 'id' } },
      enrolledAt: { type: Sequelize.DATE, allowNull: false },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'active' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('lesson_enrolments', ['userId', 'lessonId'], { unique: true, name: 'lesson_enrolments_user_lesson' });
    // Recover only lessons with evidence of participation or paid access.
    // The earliest recorded lesson event/grant sets the original access window.
    await queryInterface.sequelize.query(`INSERT INTO lesson_enrolments
      (id, userId, courseTrackId, lessonId, enrolledAt, expiresAt, status, createdAt, updatedAt)
      SELECT UUID(), evidence.userId, l.trackId, evidence.lessonId, MIN(evidence.startedAt),
        DATE_ADD(MIN(evidence.startedAt), INTERVAL 2 YEAR), 'active', NOW(), NOW()
      FROM (
        SELECT userId, lessonId, occurredAt AS startedAt FROM student_learning_history WHERE lessonId IS NOT NULL
        UNION ALL
        SELECT userId, lessonId, COALESCE(startsAt, createdAt) AS startedAt FROM entitlements
          WHERE lessonId IS NOT NULL AND status IN ('active', 'expired')
      ) evidence
      JOIN lessons l ON l.id = evidence.lessonId
      JOIN enrolments e ON e.userId = evidence.userId AND e.courseTrackId = l.trackId AND e.status = 'active'
      GROUP BY evidence.userId, evidence.lessonId, l.trackId`);
  },
  async down(queryInterface) { await queryInterface.dropTable('lesson_enrolments'); },
};
