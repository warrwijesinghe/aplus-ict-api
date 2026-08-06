"use strict";

const addColumn = async (queryInterface, column, definition) => {
  if (!(await queryInterface.describeTable("student_profiles"))[column]) await queryInterface.addColumn("student_profiles", column, definition);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumn(queryInterface, "dateOfBirth", Sequelize.DATEONLY);
    await addColumn(queryInterface, "address", Sequelize.TEXT);
    await addColumn(queryInterface, "city", Sequelize.STRING);
    await addColumn(queryInterface, "gender", Sequelize.STRING);
  },
  async down(queryInterface) {
    for (const column of ["gender", "city", "address", "dateOfBirth"]) if ((await queryInterface.describeTable("student_profiles"))[column]) await queryInterface.removeColumn("student_profiles", column);
  },
};
