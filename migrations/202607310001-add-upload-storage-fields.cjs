"use strict";

// Existing resources already store neutral storage keys. This adds the payment-slip
// reference without rewriting current development data.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("payments", "paymentSlipResourceId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "resources", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    await queryInterface.addIndex("payments", ["paymentSlipResourceId"]);
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("payments", ["paymentSlipResourceId"]);
    await queryInterface.removeColumn("payments", "paymentSlipResourceId");
  },
};
