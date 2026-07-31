"use strict";

const { QueryTypes } = require("sequelize");

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("lesson_sections");

    // The existence check lets a failed deployment retry safely if the DDL was
    // applied before Sequelize had a chance to record the migration.
    if (!columns.accessPolicy) {
      await queryInterface.addColumn("lesson_sections", "accessPolicy", {
        type: Sequelize.ENUM("free", "paid"),
        allowNull: false,
        defaultValue: "free",
      });
    }

    // Existing sections preserve the old lesson-wide rule. New sections are
    // independently configurable from the admin catalogue.
    await queryInterface.sequelize.query(
      "UPDATE lesson_sections AS section_item " +
        "INNER JOIN lessons AS lesson ON lesson.id = section_item.lessonId " +
        "SET section_item.accessPolicy = CASE " +
        "WHEN lesson.accessPolicy = 'paid' THEN 'paid' ELSE 'free' END",
      { type: QueryTypes.UPDATE },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("lesson_sections", "accessPolicy");
  },
};
