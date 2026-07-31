"use strict";

// This migration extends the initial monolith schema without changing prior migration history.
module.exports = {
  async up(queryInterface, Sequelize) {
    const id = {
      type: Sequelize.UUID,
      primaryKey: true,
      allowNull: false,
    };
    const timestamps = {
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    };

    await queryInterface.createTable("google_identities", {
      id,
      userId: { type: Sequelize.UUID, allowNull: false },
      subject: { type: Sequelize.STRING, allowNull: false, unique: true },
      emailAtLinkTime: { type: Sequelize.STRING, allowNull: false },
      ...timestamps,
    });
    await queryInterface.createTable("student_profiles", {
      id,
      userId: { type: Sequelize.UUID, allowNull: false, unique: true },
      phone: Sequelize.STRING,
      preferredMedium: Sequelize.STRING,
      ...timestamps,
    });
    await queryInterface.createTable("roles", {
      id,
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      ...timestamps,
    });
    await queryInterface.createTable("permissions", {
      id,
      code: { type: Sequelize.STRING, allowNull: false, unique: true },
      name: { type: Sequelize.STRING, allowNull: false },
      ...timestamps,
    });
    await queryInterface.createTable("user_roles", {
      id,
      userId: { type: Sequelize.UUID, allowNull: false },
      roleId: { type: Sequelize.UUID, allowNull: false },
      ...timestamps,
    });
    await queryInterface.createTable("role_permissions", {
      id,
      roleId: { type: Sequelize.UUID, allowNull: false },
      permissionId: { type: Sequelize.UUID, allowNull: false },
      ...timestamps,
    });
    await queryInterface.createTable("content_progresses", {
      id,
      userId: { type: Sequelize.UUID, allowNull: false },
      lessonSectionId: { type: Sequelize.UUID, allowNull: false },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "not_started",
      },
      lastPosition: Sequelize.STRING,
      completedAt: Sequelize.DATE,
      ...timestamps,
    });

    await queryInterface.addIndex("google_identities", ["userId"]);
    await queryInterface.addIndex("user_roles", ["userId", "roleId"], {
      unique: true,
    });
    await queryInterface.addIndex(
      "role_permissions",
      ["roleId", "permissionId"],
      {
        unique: true,
      },
    );
    await queryInterface.addIndex(
      "content_progresses",
      ["userId", "lessonSectionId"],
      {
        unique: true,
      },
    );
  },
  async down(queryInterface) {
    for (const table of [
      "content_progresses",
      "role_permissions",
      "user_roles",
      "permissions",
      "roles",
      "student_profiles",
      "google_identities",
    ]) {
      await queryInterface.dropTable(table);
    }
  },
};
