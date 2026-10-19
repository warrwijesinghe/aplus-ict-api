"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("courses");
    if (!columns.tutorialImageResourceId) {
      await queryInterface.addColumn("courses", "tutorialImageResourceId", {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "resources", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }
  },
  async down(queryInterface) {
    const columns = await queryInterface.describeTable("courses");
    if (columns.tutorialImageResourceId) await queryInterface.removeColumn("courses", "tutorialImageResourceId");
  },
};
