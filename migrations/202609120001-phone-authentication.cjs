"use strict";

module.exports = {
  async up(q, S) {
    // MariaDB DDL auto-commits; make each step safe to resume after interruption.
    const columns = await q.describeTable("users");
    if (!columns.phoneNumber) await q.addColumn("users", "phoneNumber", { type: S.STRING(20), allowNull: true });
    if (!columns.phoneVerifiedAt) await q.addColumn("users", "phoneVerifiedAt", { type: S.DATE, allowNull: true });
    if (!columns.authVersion) await q.addColumn("users", "authVersion", { type: S.INTEGER, allowNull: false, defaultValue: 0 });
    if (!(await q.showIndex("users")).some((index) => index.name === "users_phone_unique"))
      await q.addIndex("users", ["phoneNumber"], { unique: true, name: "users_phone_unique" });
    await q.changeColumn("users", "email", { type: S.STRING, allowNull: true });
    if (!(await q.showAllTables()).map(String).includes("phone_challenges")) {
      await q.createTable("phone_challenges", {
        id: { type: S.UUID, primaryKey: true, allowNull: false },
        phoneNumber: { type: S.STRING(20), allowNull: false },
        purpose: { type: S.STRING(20), allowNull: false },
        challengeId: { type: S.UUID, unique: true },
        codeHash: S.STRING(64), verificationHash: S.STRING(64),
        expiresAt: S.DATE, verifiedAt: S.DATE, consumedAt: S.DATE,
        attempts: { type: S.INTEGER, defaultValue: 0 },
        sentAt: S.DATE, windowStartedAt: S.DATE,
        sendCount: { type: S.INTEGER, defaultValue: 0 },
        createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false },
      });
    }
    if (!(await q.showIndex("phone_challenges")).some((index) => index.name === "phone_challenges_phone_purpose"))
      await q.addIndex("phone_challenges", ["phoneNumber", "purpose"], { unique: true, name: "phone_challenges_phone_purpose" });
  },
  async down() {
    throw new Error("Phone authentication contains account credentials. Restore a reviewed backup to roll back safely.");
  },
};
