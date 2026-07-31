"use strict";

// This table separates public download metadata from low-level file storage.
// It lets one resource browser support A/L, O/L, and future learning areas.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("downloadable_resources", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      resourceId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: Sequelize.TEXT,
      resourceType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      academicLevel: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      medium: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "all",
      },
      accessPolicy: {
        type: Sequelize.ENUM("free", "paid"),
        allowNull: false,
        defaultValue: "free",
      },
      status: {
        type: Sequelize.ENUM("draft", "published", "archived"),
        allowNull: false,
        defaultValue: "draft",
      },
      sortOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("downloadable_resources", [
      "status",
      "academicLevel",
      "medium",
    ]);
    await queryInterface.addIndex("downloadable_resources", [
      "status",
      "resourceType",
      "accessPolicy",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("downloadable_resources");
  },
};
