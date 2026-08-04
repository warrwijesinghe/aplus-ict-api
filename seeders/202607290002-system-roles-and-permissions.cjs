"use strict";

module.exports = {
  async up(queryInterface) {
    // Superseded by the complete catalogue seeder. Kept as a safe no-op so
    // existing deployment histories can still run `db:seed` repeatedly.
    return undefined;
  },
  async down(queryInterface) {
    // System roles are shared security data; never remove them from a legacy down seeder.
  },
};
