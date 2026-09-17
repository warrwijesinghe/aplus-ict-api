"use strict";

module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async (transaction) => {
      const options = { transaction };
      const otpColumns = await q.describeTable("phone_otp_challenges");
      if (!otpColumns.providerMessageId) await q.addColumn("phone_otp_challenges", "providerMessageId", { type: S.STRING, allowNull: true }, options);
      if (!otpColumns.requestIp) await q.addColumn("phone_otp_challenges", "requestIp", { type: S.STRING(64), allowNull: true }, options);
      await q.changeColumn("phone_otp_challenges", "purpose", { type: S.ENUM("register", "reset", "login"), allowNull: false }, options);
      const userColumns = await q.describeTable("users");
      if (!userColumns.phoneVerifiedAt) await q.addColumn("users", "phoneVerifiedAt", { type: S.DATE, allowNull: true }, options);
      await q.addIndex("phone_otp_challenges", ["phoneNumber", "consumedAt", "createdAt"], { name: "phone_otp_challenges_active_lookup", transaction });
    });
  },
  async down(q) {
    await q.removeIndex("phone_otp_challenges", "phone_otp_challenges_active_lookup");
    await q.removeColumn("phone_otp_challenges", "requestIp");
    await q.removeColumn("phone_otp_challenges", "providerMessageId");
    await q.removeColumn("users", "phoneVerifiedAt");
  },
};
