"use strict";

const tableOptions = { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" };
const timestampColumns = (Sequelize) => ({ createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false } });
const hasTable = async (queryInterface, table) => (await queryInterface.showAllTables()).map(String).includes(table);
const addIndex = async (queryInterface, table, fields, name, unique = false) => {
  if (!(await queryInterface.showIndex(table)).some((index) => index.name === name)) await queryInterface.addIndex(table, fields, { name, unique });
};

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await hasTable(queryInterface, "student_course_states"))) await queryInterface.createTable("student_course_states", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
      courseTrackId: { type: Sequelize.UUID, allowNull: false, references: { model: "course_tracks", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
      lastLessonId: { type: Sequelize.UUID, references: { model: "lessons", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
      lastTopicId: { type: Sequelize.UUID, references: { model: "topics", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
      lastActivityId: { type: Sequelize.UUID, references: { model: "lesson_sections", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
      lastAccessedAt: Sequelize.DATE,
      ...timestampColumns(Sequelize),
    }, tableOptions);
    if (!(await hasTable(queryInterface, "student_learning_history"))) await queryInterface.createTable("student_learning_history", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
      courseTrackId: { type: Sequelize.UUID, allowNull: false, references: { model: "course_tracks", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
      lessonId: Sequelize.UUID, topicId: Sequelize.UUID, activityId: Sequelize.UUID, quizId: Sequelize.UUID, quizAttemptId: Sequelize.UUID,
      eventType: { type: Sequelize.ENUM("course_enrolled", "course_opened", "lesson_opened", "activity_opened", "activity_completed", "quiz_started", "quiz_submitted", "quiz_passed"), allowNull: false },
      occurredAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      metadata: Sequelize.JSON,
      ...timestampColumns(Sequelize),
    }, tableOptions);
    await addIndex(queryInterface, "student_course_states", ["userId", "courseTrackId"], "student_course_state_user_track_unique", true);
    await addIndex(queryInterface, "student_course_states", ["userId", "lastAccessedAt"], "student_course_state_last_accessed");
    await addIndex(queryInterface, "student_learning_history", ["userId", "occurredAt"], "student_history_user_occurred");
    await addIndex(queryInterface, "student_learning_history", ["courseTrackId", "occurredAt"], "student_history_track_occurred");
  },
  async down(queryInterface) {
    // These tables may have been created by the original dashboard migration.
    // Preserve them on rollback to avoid deleting students' learning records.
  },
};
