"use strict";

const addIfMissing = async (queryInterface, table, column, definition, options) => {
  const columns = await queryInterface.describeTable(table);
  if (!columns[column]) await queryInterface.addColumn(table, column, definition, options);
};
const addIndexIfMissing = async (queryInterface, table, fields, options) => {
  const indexes = await queryInterface.showIndex(table);
  if (!indexes.some((index) => index.name === options.name)) await queryInterface.addIndex(table, fields, options);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const options = { transaction };
      for (const [column, definition] of Object.entries({
        fullName: Sequelize.STRING, mobileNumber: Sequelize.STRING, whatsAppNumber: Sequelize.STRING,
        examYear: Sequelize.INTEGER, schoolName: Sequelize.STRING, district: Sequelize.STRING,
        town: Sequelize.STRING, guardianContactNumber: Sequelize.STRING, referralSource: Sequelize.STRING,
      })) await addIfMissing(queryInterface, "student_profiles", column, definition, options);
      await addIfMissing(queryInterface, "enrolments", "courseTrackId", Sequelize.UUID, options);
      await addIfMissing(queryInterface, "enrolments", "enrolledAt", Sequelize.DATE, options);
      await addIfMissing(queryInterface, "enrolments", "lastAccessedAt", Sequelize.DATE, options);
      await addIfMissing(queryInterface, "orders", "idempotencyKey", Sequelize.STRING, options);
      await addIfMissing(queryInterface, "payments", "rejectedBy", Sequelize.UUID, options);
      await addIfMissing(queryInterface, "payments", "rejectedAt", Sequelize.DATE, options);
      await addIfMissing(queryInterface, "payments", "rejectionReason", Sequelize.TEXT, options);
      await addIndexIfMissing(queryInterface, "enrolments", ["userId", "courseTrackId"], { name: "enrolments_user_track_unique", unique: true, ...options });
      await addIndexIfMissing(queryInterface, "enrolments", ["userId", "lastAccessedAt"], { name: "enrolments_user_last_accessed", ...options });
      await addIndexIfMissing(queryInterface, "orders", ["idempotencyKey"], { name: "orders_idempotency_key_unique", unique: true, ...options });
      await addIndexIfMissing(queryInterface, "payments", ["status", "createdAt"], { name: "payments_status_submitted_at", ...options });
    });
  },
  async down(queryInterface) {
    for (const [table, index] of [["payments", "payments_status_submitted_at"], ["orders", "orders_idempotency_key_unique"], ["enrolments", "enrolments_user_last_accessed"], ["enrolments", "enrolments_user_track_unique"]]) await queryInterface.removeIndex(table, index);
    for (const [table, column] of [["payments", "rejectionReason"], ["payments", "rejectedAt"], ["payments", "rejectedBy"], ["orders", "idempotencyKey"], ["enrolments", "lastAccessedAt"], ["enrolments", "enrolledAt"], ["enrolments", "courseTrackId"], ["student_profiles", "referralSource"], ["student_profiles", "guardianContactNumber"], ["student_profiles", "town"], ["student_profiles", "district"], ["student_profiles", "schoolName"], ["student_profiles", "examYear"], ["student_profiles", "whatsAppNumber"], ["student_profiles", "mobileNumber"], ["student_profiles", "fullName"]]) await queryInterface.removeColumn(table, column);
  },
};
