"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("courses", "featuredImageResourceId", {
      type: Sequelize.UUID,
      references: { model: "resources", key: "id" },
      onDelete: "SET NULL",
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn("courses", "featuredImageResourceId");
  },
};
