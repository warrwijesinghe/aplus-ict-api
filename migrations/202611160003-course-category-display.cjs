"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("categories", "subtitle", { type: Sequelize.STRING });
    await queryInterface.addColumn("categories", "featuredImageResourceId", {
      type: Sequelize.UUID,
      references: { model: "resources", key: "id" },
      onDelete: "SET NULL",
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("categories", "featuredImageResourceId");
    await queryInterface.removeColumn("categories", "subtitle");
  },
};
