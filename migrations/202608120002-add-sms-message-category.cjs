"use strict";

module.exports = {
  async up(q, S) {
    const columns = await q.describeTable("sms_messages");
    if (!columns.category) {
      await q.addColumn("sms_messages", "category", { type: S.STRING(30), allowNull: false, defaultValue: "general" });
      await q.addIndex("sms_messages", ["category", "createdAt"], { name: "sms_messages_category_created" });
    }
  },
  async down(q) {
    const columns = await q.describeTable("sms_messages");
    if (columns.category) await q.removeColumn("sms_messages", "category");
  },
};
