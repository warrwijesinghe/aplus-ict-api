"use strict";

const INDEX = "sms_messages_event_key_unique";

module.exports = {
  async up(q, S) {
    const columns = await q.describeTable("sms_messages");
    if (!columns.eventKey)
      await q.addColumn("sms_messages", "eventKey", { type: S.STRING(191), allowNull: true });
    if (!(await q.showIndex("sms_messages")).some((index) => index.name === INDEX))
      await q.addIndex("sms_messages", ["eventKey"], { name: INDEX, unique: true });
  },
  async down(q) {
    if ((await q.showIndex("sms_messages")).some((index) => index.name === INDEX))
      await q.removeIndex("sms_messages", INDEX);
    const columns = await q.describeTable("sms_messages");
    if (columns.eventKey) await q.removeColumn("sms_messages", "eventKey");
  },
};
