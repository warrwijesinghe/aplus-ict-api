"use strict";

module.exports = {
  async up(q) {
    // Execute DDL through the MariaDB connection: Sequelize 6's MariaDB adapter
    // is incompatible with Node 24's non-configurable query metadata for DROP.
    const connection = await q.sequelize.connectionManager.getConnection();
    try {
      await connection.query("DROP TABLE IF EXISTS `google_identities`");
      const columns = await connection.query("SHOW COLUMNS FROM `users` LIKE 'googleId'");
      if (columns.length) await connection.query("ALTER TABLE `users` DROP COLUMN `googleId`");
    } finally {
      await q.sequelize.connectionManager.releaseConnection(connection);
    }
  },
  async down() {
    throw new Error("Google authentication removal is intentionally irreversible");
  },
};
