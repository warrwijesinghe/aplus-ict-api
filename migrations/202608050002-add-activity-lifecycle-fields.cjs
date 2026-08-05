"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("lesson_sections");
    if (!columns.configVersion) await queryInterface.addColumn("lesson_sections", "configVersion", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 });
    if (!columns.publishedAt) await queryInterface.addColumn("lesson_sections", "publishedAt", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.sequelize.query("UPDATE lesson_sections SET configVersion = 1 WHERE configVersion IS NULL");
    await queryInterface.sequelize.query("UPDATE lesson_sections SET publishedAt = createdAt WHERE status = 'published' AND publishedAt IS NULL");
  },
  async down(queryInterface) {
    const columns = await queryInterface.describeTable("lesson_sections");
    if (columns.publishedAt) await queryInterface.removeColumn("lesson_sections", "publishedAt");
    if (columns.configVersion) await queryInterface.removeColumn("lesson_sections", "configVersion");
  },
};
