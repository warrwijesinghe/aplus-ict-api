"use strict";

// Course/track publishing remains a separate draft/published/archived
// lifecycle. This migration simplifies the student-facing availability flag.
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("course_tracks");
    if (!columns.availabilityStatus) {
      await queryInterface.addColumn("course_tracks", "availabilityStatus", {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "active",
      });
    }

    // Existing coming-soon tracks become available for enrolment as requested.
    // Paused and archived availability states remain unavailable.
    await queryInterface.sequelize.query(
      "UPDATE course_tracks SET availabilityStatus = CASE WHEN availabilityStatus IN ('paused', 'archived') THEN 'inactive' ELSE 'active' END",
    );
    await queryInterface.changeColumn("course_tracks", "availabilityStatus", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "active",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("course_tracks", "availabilityStatus", {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: "active",
    });
  },
};
