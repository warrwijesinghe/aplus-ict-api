"use strict";

const tableOptions = { charset: "utf8mb4", collate: "utf8mb4_unicode_ci" };
const hasColumn = async (queryInterface, table, column) => (await queryInterface.describeTable(table))[column];
const addColumn = async (queryInterface, table, column, definition, options) => {
  if (!(await hasColumn(queryInterface, table, column))) await queryInterface.addColumn(table, column, definition, options);
};
const addIndex = async (queryInterface, table, fields, options) => {
  if (!(await queryInterface.showIndex(table)).some((index) => index.name === options.name)) await queryInterface.addIndex(table, fields, options);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const options = { transaction };
      await addColumn(queryInterface, "student_profiles", "profileStatus", Sequelize.ENUM("incomplete", "complete"), options);
      await addColumn(queryInterface, "student_profiles", "completedAt", Sequelize.DATE, options);
      await addColumn(queryInterface, "enrolments", "unenrolledAt", Sequelize.DATE, options);
      await addColumn(queryInterface, "enrolments", "createdByUserId", Sequelize.UUID, options);
      await queryInterface.createTable("student_course_states", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
        courseTrackId: { type: Sequelize.UUID, allowNull: false, references: { model: "course_tracks", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
        lastLessonId: { type: Sequelize.UUID, allowNull: true, references: { model: "lessons", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
        lastTopicId: { type: Sequelize.UUID, allowNull: true, references: { model: "topics", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
        lastActivityId: { type: Sequelize.UUID, allowNull: true, references: { model: "lesson_sections", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
        lastAccessedAt: Sequelize.DATE,
        createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { ...tableOptions, transaction });
      await queryInterface.createTable("student_learning_history", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
        courseTrackId: { type: Sequelize.UUID, allowNull: false, references: { model: "course_tracks", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE" },
        lessonId: Sequelize.UUID, topicId: Sequelize.UUID, activityId: Sequelize.UUID, quizId: Sequelize.UUID, quizAttemptId: Sequelize.UUID,
        eventType: { type: Sequelize.ENUM("course_enrolled", "course_opened", "lesson_opened", "activity_opened", "activity_completed", "quiz_started", "quiz_submitted", "quiz_passed"), allowNull: false },
        occurredAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") }, metadata: Sequelize.JSON,
        createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
      }, { ...tableOptions, transaction });
      await addIndex(queryInterface, "student_course_states", ["userId", "courseTrackId"], { name: "student_course_state_user_track_unique", unique: true, ...options });
      await addIndex(queryInterface, "student_course_states", ["userId", "lastAccessedAt"], { name: "student_course_state_last_accessed", ...options });
      await addIndex(queryInterface, "student_learning_history", ["userId", "occurredAt"], { name: "student_history_user_occurred", ...options });
      await addIndex(queryInterface, "student_learning_history", ["courseTrackId", "occurredAt"], { name: "student_history_track_occurred", ...options });
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("student_learning_history");
    await queryInterface.dropTable("student_course_states");
    await queryInterface.removeColumn("enrolments", "createdByUserId");
    await queryInterface.removeColumn("enrolments", "unenrolledAt");
    await queryInterface.removeColumn("student_profiles", "completedAt");
    await queryInterface.removeColumn("student_profiles", "profileStatus");
  },
};
