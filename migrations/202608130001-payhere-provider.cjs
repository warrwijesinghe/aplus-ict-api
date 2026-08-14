"use strict";

module.exports = {
  async up(queryInterface) {
    // Preserve historical provider rows under a neutral legacy value while
    // removing the retired gateway from active configuration and schema values.
    // MySQL validates ENUM values on UPDATE, so permit the transitional value
    // before converting the existing DirectPay rows.
    await queryInterface.sequelize.query("ALTER TABLE payment_transactions MODIFY provider ENUM('directpay','legacy','payhere') NOT NULL DEFAULT 'payhere'");
    await queryInterface.sequelize.query("ALTER TABLE payment_provider_events MODIFY provider ENUM('directpay','legacy','payhere') NOT NULL DEFAULT 'payhere'");
    await queryInterface.sequelize.query("UPDATE payment_transactions SET provider='legacy' WHERE provider='directpay'");
    await queryInterface.sequelize.query("UPDATE payment_provider_events SET provider='legacy' WHERE provider='directpay'");
    await queryInterface.sequelize.query("ALTER TABLE payment_transactions MODIFY provider ENUM('legacy','payhere') NOT NULL DEFAULT 'payhere'");
    await queryInterface.sequelize.query("ALTER TABLE payment_provider_events MODIFY provider ENUM('legacy','payhere') NOT NULL DEFAULT 'payhere'");
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query("UPDATE payment_provider_events SET provider='legacy' WHERE provider='payhere'");
    await queryInterface.sequelize.query("UPDATE payment_transactions SET provider='legacy' WHERE provider='payhere'");
    await queryInterface.sequelize.query("ALTER TABLE payment_provider_events MODIFY provider ENUM('legacy') NOT NULL DEFAULT 'legacy'");
    await queryInterface.sequelize.query("ALTER TABLE payment_transactions MODIFY provider ENUM('legacy') NOT NULL DEFAULT 'legacy'");
  },
};
