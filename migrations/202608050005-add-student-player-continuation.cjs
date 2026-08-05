"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("enrolments", "lastAccessedActivityId", {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addIndex("enrolments", ["userId", "courseTrackId", "lastAccessedActivityId"], {
      name: "enrolments_student_course_last_activity",
    });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("enrolments", "enrolments_student_course_last_activity");
    await queryInterface.removeColumn("enrolments", "lastAccessedActivityId");
  },
};
