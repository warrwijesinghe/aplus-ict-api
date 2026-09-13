"use strict";

const timestamps = (S) => ({
  id: { type: S.UUID, primaryKey: true, allowNull: false, defaultValue: S.UUIDV4 },
  createdAt: { type: S.DATE, allowNull: false },
  updatedAt: { type: S.DATE, allowNull: false },
});

module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async (transaction) => {
      const options = { transaction };
      const columns = await q.describeTable("users");
      if (!columns.phoneNumber)
        await q.addColumn("users", "phoneNumber", { type: S.STRING(20), allowNull: true }, options);
      if (!columns.email.allowNull)
        await q.changeColumn("users", "email", { type: S.STRING, allowNull: true, unique: true }, options);
      if (!(await q.showAllTables()).map(String).includes("phone_otp_challenges"))
        await q.createTable("phone_otp_challenges", {
          ...timestamps(S),
          phoneNumber: { type: S.STRING(20), allowNull: false },
          purpose: { type: S.ENUM("register", "reset"), allowNull: false },
          codeHash: { type: S.STRING(64), allowNull: false },
          expiresAt: { type: S.DATE, allowNull: false },
          resendAvailableAt: { type: S.DATE, allowNull: false },
          attempts: { type: S.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
          verifiedAt: S.DATE,
          consumedAt: S.DATE,
        }, options);
      await q.addIndex("users", ["phoneNumber"], { name: "users_phone_number_unique", unique: true, transaction });
      await q.addIndex("phone_otp_challenges", ["phoneNumber", "purpose", "createdAt"], { name: "phone_otp_challenges_lookup", transaction });
    });
  },
  async down(q) {
    await q.dropTable("phone_otp_challenges");
    await q.removeColumn("users", "phoneNumber");
    await q.changeColumn("users", "email", { type: require("sequelize").DataTypes.STRING, allowNull: false, unique: true });
  },
};
