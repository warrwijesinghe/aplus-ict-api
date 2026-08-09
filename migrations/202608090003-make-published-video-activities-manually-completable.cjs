"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "UPDATE lesson_sections SET completionMode = 'manual' WHERE type = 'video' AND status = 'published' AND isVisible <> false",
    );
  },

  async down() {
    // The previous completion setting may have been deliberately configured
    // per video, so it cannot be safely inferred or overwritten on rollback.
  },
};
