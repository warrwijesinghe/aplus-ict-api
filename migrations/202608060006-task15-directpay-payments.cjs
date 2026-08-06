"use strict";

const { randomUUID } = require("crypto");
const timestamps = (S) => ({ id: { type: S.UUID, primaryKey: true, allowNull: false, defaultValue: S.UUIDV4 }, createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false } });
const addIndex = async (q, table, fields, name, unique = false) => { if (!(await q.showIndex(table)).some((item) => item.name === name)) await q.addIndex(table, fields, { name, unique }); };

module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async (transaction) => {
      const options = { transaction };
      const tables = (await q.showAllTables()).map(String);
      if (!tables.includes("payment_transactions")) await q.createTable("payment_transactions", {
        ...timestamps(S), orderId: { type: S.UUID, allowNull: false, references: { model: "orders", key: "id" }, onDelete: "RESTRICT" }, provider: { type: S.ENUM("directpay"), allowNull: false, defaultValue: "directpay" }, providerTransactionId: S.STRING, providerReference: S.STRING, merchantReference: { type: S.STRING, allowNull: false, unique: true }, idempotencyKey: { type: S.STRING, allowNull: false, unique: true }, status: { type: S.ENUM("created", "initiation_pending", "initiated", "customer_action_required", "processing", "verified", "completed", "failed", "cancelled", "expired", "verification_failed", "amount_mismatch"), allowNull: false, defaultValue: "created" }, currency: { type: S.CHAR(3), allowNull: false, defaultValue: "LKR" }, amount: { type: S.DECIMAL(12, 2), allowNull: false }, requestAmount: { type: S.DECIMAL(12, 2), allowNull: false }, verifiedAmount: S.DECIMAL(12, 2), paymentMethod: S.STRING, providerStatusCode: S.STRING, providerStatusMessage: S.STRING, initiatedAt: S.DATE, providerCreatedAt: S.DATE, verifiedAt: S.DATE, completedAt: S.DATE, failedAt: S.DATE, cancelledAt: S.DATE, lastStatusCheckedAt: S.DATE, verificationSource: S.STRING,
      }, options);
      if (!tables.includes("payment_provider_events")) await q.createTable("payment_provider_events", {
        ...timestamps(S), provider: { type: S.ENUM("directpay"), allowNull: false, defaultValue: "directpay" }, providerEventId: S.STRING, paymentTransactionId: { type: S.UUID, references: { model: "payment_transactions", key: "id" }, onDelete: "RESTRICT" }, orderId: { type: S.UUID, references: { model: "orders", key: "id" }, onDelete: "RESTRICT" }, eventType: { type: S.STRING, allowNull: false }, eventStatus: S.STRING, payloadHash: { type: S.STRING(64), allowNull: false, unique: true }, signatureValid: S.BOOLEAN, processed: { type: S.BOOLEAN, allowNull: false, defaultValue: false }, processedAt: S.DATE, processingError: S.STRING, receivedAt: { type: S.DATE, allowNull: false, defaultValue: S.NOW },
      }, options);
      await addIndex(q, "payment_transactions", ["orderId", "status"], "payment_transactions_order_status");
      await addIndex(q, "payment_transactions", ["provider", "providerTransactionId"], "payment_transactions_provider_transaction");
      await addIndex(q, "payment_transactions", ["status", "lastStatusCheckedAt"], "payment_transactions_reconciliation");
      await addIndex(q, "payment_provider_events", ["paymentTransactionId", "receivedAt"], "payment_provider_events_transaction_received");
      await addIndex(q, "payment_provider_events", ["provider", "providerEventId"], "payment_provider_events_provider_event", true);
      const codes = ["payments.view", "payments.reconcile", "payments.view_events"], now = new Date();
      for (const code of codes) await q.sequelize.query("INSERT INTO permissions (id, code, name, description, module, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), module=VALUES(module)", { replacements: [randomUUID(), code, code.replaceAll('.', ' '), `Allows ${code}`, "payments", now, now], transaction });
      for (const role of ["admin", "super_admin"]) for (const code of codes) await q.sequelize.query("INSERT INTO role_permissions (id, roleId, permissionId, createdAt, updatedAt) SELECT ?, r.id, p.id, ?, ? FROM roles r JOIN permissions p WHERE r.code=? AND p.code=? AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.roleId=r.id AND rp.permissionId=p.id)", { replacements: [randomUUID(), now, now, role, code], transaction });
    });
  },
  async down(q) {
    await q.dropTable("payment_provider_events");
    await q.dropTable("payment_transactions");
    await q.sequelize.query("DELETE rp FROM role_permissions rp INNER JOIN permissions p ON p.id=rp.permissionId WHERE p.code IN ('payments.view','payments.reconcile','payments.view_events')");
    await q.sequelize.query("DELETE FROM permissions WHERE code IN ('payments.view','payments.reconcile','payments.view_events')");
  },
};
