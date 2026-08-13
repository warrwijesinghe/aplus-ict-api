"use strict";

const { randomUUID } = require("crypto");
const timestamps = (S) => ({
  id: { type: S.UUID, primaryKey: true, allowNull: false, defaultValue: S.UUIDV4 },
  createdAt: { type: S.DATE, allowNull: false },
  updatedAt: { type: S.DATE, allowNull: false },
});
const addIndex = async (q, table, fields, name) => {
  if (!(await q.showIndex(table)).some((item) => item.name === name))
    await q.addIndex(table, fields, { name });
};

module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async (transaction) => {
      const options = { transaction };
      const tables = (await q.showAllTables()).map(String);
      if (!tables.includes("sms_messages"))
        await q.createTable("sms_messages", {
          ...timestamps(S),
          recipient: { type: S.STRING(20), allowNull: false },
          sender: { type: S.STRING(11), allowNull: false },
          text: { type: S.STRING(160), allowNull: false },
          messageType: { type: S.TINYINT, allowNull: false, defaultValue: 0 },
          contentType: { type: S.ENUM("standard", "multilingual"), allowNull: false, defaultValue: "standard" },
          status: { type: S.ENUM("queued", "sending", "sent", "failed"), allowNull: false, defaultValue: "queued" },
          attemptCount: { type: S.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          maxAttempts: { type: S.INTEGER.UNSIGNED, allowNull: false, defaultValue: 3 },
          nextAttemptAt: { type: S.DATE, allowNull: false },
          lastAttemptAt: S.DATE,
          acceptedAt: S.DATE,
          failedAt: S.DATE,
          gatewayCode: S.STRING(16),
          gatewayResponse: S.TEXT,
          failureReason: S.STRING(500),
          createdByUserId: { type: S.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "RESTRICT" },
          resentFromMessageId: { type: S.UUID, references: { model: "sms_messages", key: "id" }, onDelete: "SET NULL" },
        }, options);
      if (!tables.includes("sms_message_attempts"))
        await q.createTable("sms_message_attempts", {
          ...timestamps(S),
          smsMessageId: { type: S.UUID, allowNull: false, references: { model: "sms_messages", key: "id" }, onDelete: "CASCADE" },
          attemptNumber: { type: S.INTEGER.UNSIGNED, allowNull: false },
          status: { type: S.ENUM("sending", "accepted", "failed"), allowNull: false, defaultValue: "sending" },
          gatewayCode: S.STRING(16),
          gatewayResponse: S.TEXT,
          failureReason: S.STRING(500),
          startedAt: { type: S.DATE, allowNull: false },
          completedAt: S.DATE,
        }, options);
      if (!tables.includes("sms_inbound_messages"))
        await q.createTable("sms_inbound_messages", {
          ...timestamps(S),
          sender: { type: S.STRING(20), allowNull: false },
          recipient: { type: S.STRING(20), allowNull: false },
          message: { type: S.TEXT, allowNull: false },
          receivedAt: { type: S.DATE, allowNull: false },
        }, options);
      await addIndex(q, "sms_messages", ["status", "nextAttemptAt"], "sms_messages_pending_queue");
      await addIndex(q, "sms_messages", ["createdByUserId", "createdAt"], "sms_messages_creator_created");
      await addIndex(q, "sms_message_attempts", ["smsMessageId", "attemptNumber"], "sms_attempts_message_number");
      const codes = ["sms.read", "sms.send", "sms.resend"], now = new Date();
      for (const code of codes)
        await q.sequelize.query(
          "INSERT INTO permissions (id, code, name, description, module, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), module=VALUES(module)",
          { replacements: [randomUUID(), code, code.replaceAll(".", " "), `Allows ${code}`, "sms", now, now], transaction },
        );
      for (const role of ["admin", "super_admin"])
        for (const code of codes)
          await q.sequelize.query(
            "INSERT INTO role_permissions (id, roleId, permissionId, createdAt, updatedAt) SELECT ?, r.id, p.id, ?, ? FROM roles r JOIN permissions p WHERE r.code=? AND p.code=? AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.roleId=r.id AND rp.permissionId=p.id)",
            { replacements: [randomUUID(), now, now, role, code], transaction },
          );
    });
  },
  async down(q) {
    await q.sequelize.query("DELETE rp FROM role_permissions rp INNER JOIN permissions p ON p.id=rp.permissionId WHERE p.code IN ('sms.read','sms.send','sms.resend')");
    await q.sequelize.query("DELETE FROM permissions WHERE code IN ('sms.read','sms.send','sms.resend')");
    await q.dropTable("sms_inbound_messages");
    await q.dropTable("sms_message_attempts");
    await q.dropTable("sms_messages");
  },
};
