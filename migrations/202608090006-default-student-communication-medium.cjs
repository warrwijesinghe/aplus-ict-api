"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "UPDATE student_profiles SET preferredMedium = 'sinhala' WHERE preferredMedium IS NULL OR preferredMedium NOT IN ('sinhala', 'english')",
    );
    await queryInterface.changeColumn("student_profiles", "preferredMedium", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "sinhala",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn("student_profiles", "preferredMedium", {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: null,
    });
  },
};
