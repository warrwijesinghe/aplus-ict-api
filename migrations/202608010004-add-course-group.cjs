"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("courses");
    if (!columns.courseGroup)
      await queryInterface.addColumn("courses", "courseGroup", Sequelize.STRING);
    await queryInterface.addIndex("courses", ["courseGroup", "academicLevelId", "isPublic", "sortOrder"], {
      name: "courses_area_catalogue_filters",
    });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("courses", "courses_area_catalogue_filters");
    await queryInterface.removeColumn("courses", "courseGroup");
  },
};
