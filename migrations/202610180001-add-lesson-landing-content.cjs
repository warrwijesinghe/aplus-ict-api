"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("lessons");
    if (!columns.landingPageContent) await queryInterface.addColumn("lessons", "landingPageContent", { type: Sequelize.JSON, allowNull: true });
  },
  async down(queryInterface) {
    const columns = await queryInterface.describeTable("lessons");
    if (columns.landingPageContent) await queryInterface.removeColumn("lessons", "landingPageContent");
  },
};
