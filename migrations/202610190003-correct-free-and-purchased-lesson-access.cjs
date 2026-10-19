"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('lesson_enrolments', 'expiresAt', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Free membership has no end date. Never alter activity/completion records.
      await queryInterface.sequelize.query('UPDATE lesson_enrolments SET expiresAt = NULL', { transaction });
      // Repair the existing paid entitlement, rather than copying expiry into enrolments.
      // completedAt is set by PayHere and both manual verification flows. Historic
      // confirmation timestamps/grant timestamps cover legacy successful orders.
      await queryInterface.sequelize.query(`UPDATE entitlements e
        JOIN orders o ON o.id = COALESCE(e.orderId, e.sourceId)
        SET e.startsAt = COALESCE(o.completedAt,
          (SELECT MIN(COALESCE(p.verifiedAt, p.completedAt)) FROM payment_transactions p WHERE p.orderId = o.id AND p.status IN ('verified', 'completed')),
          (SELECT MIN(p.confirmedAt) FROM payments p WHERE p.orderId = o.id AND p.status = 'confirmed'),
          e.startsAt, e.createdAt)
        WHERE e.sourceType = 'order' AND e.entitlementType = 'lesson_premium_access'
          AND o.paymentStatus = 'verified' AND o.status IN ('paid', 'completed')`, { transaction });
      await queryInterface.sequelize.query(`UPDATE entitlements e
        JOIN orders o ON o.id = COALESCE(e.orderId, e.sourceId)
        SET e.endsAt = DATE_ADD(e.startsAt, INTERVAL 2 YEAR),
          e.status = CASE WHEN e.status IN ('active', 'expired') THEN
            CASE WHEN DATE_ADD(e.startsAt, INTERVAL 2 YEAR) > NOW() THEN 'active' ELSE 'expired' END ELSE e.status END
        WHERE e.sourceType = 'order' AND e.entitlementType = 'lesson_premium_access'
          AND o.paymentStatus = 'verified' AND o.status IN ('paid', 'completed')`, { transaction });
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('UPDATE lesson_enrolments SET expiresAt = DATE_ADD(enrolledAt, INTERVAL 2 YEAR) WHERE expiresAt IS NULL');
    await queryInterface.changeColumn('lesson_enrolments', 'expiresAt', { type: Sequelize.DATE, allowNull: false });
    // Corrected paid payment dates are intentionally retained on rollback.
  },
};
