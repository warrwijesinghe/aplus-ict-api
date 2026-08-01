"use strict";

const timestampColumns = {
  createdAt: { type: require("sequelize").DataTypes.DATE, allowNull: false },
  updatedAt: { type: require("sequelize").DataTypes.DATE, allowNull: false },
};

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
  const columns = await queryInterface.describeTable(table);
  if (!columns[column]) await queryInterface.addColumn(table, column, definition);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const levels = await queryInterface.showAllTables();
    if (!levels.includes("academic_levels")) {
      await queryInterface.createTable("academic_levels", {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        code: { type: Sequelize.STRING, allowNull: false, unique: true },
        nameEn: { type: Sequelize.STRING, allowNull: false },
        nameSi: { type: Sequelize.STRING, allowNull: false },
        sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        ...timestampColumns,
      });
    }

    await addColumnIfMissing(queryInterface, "courses", "academicLevelId", Sequelize.UUID);
    await addColumnIfMissing(queryInterface, "courses", "titleEn", Sequelize.STRING);
    await addColumnIfMissing(queryInterface, "courses", "titleSi", Sequelize.STRING);
    await addColumnIfMissing(queryInterface, "courses", "shortDescriptionEn", Sequelize.TEXT);
    await addColumnIfMissing(queryInterface, "courses", "shortDescriptionSi", Sequelize.TEXT);
    await addColumnIfMissing(queryInterface, "courses", "isFeatured", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumnIfMissing(queryInterface, "courses", "isPublic", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumnIfMissing(queryInterface, "courses", "publishedAt", Sequelize.DATE);
    await addColumnIfMissing(queryInterface, "media", "nameEn", Sequelize.STRING);
    await addColumnIfMissing(queryInterface, "media", "nameSi", Sequelize.STRING);
    await addColumnIfMissing(queryInterface, "media", "sortOrder", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnIfMissing(queryInterface, "media", "isActive", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumnIfMissing(queryInterface, "course_tracks", "availabilityStatus", { type: Sequelize.STRING, allowNull: false, defaultValue: "active" });
    await addColumnIfMissing(queryInterface, "course_tracks", "isPublic", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumnIfMissing(queryInterface, "course_tracks", "enrolmentOpen", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });

    await queryInterface.addIndex("academic_levels", ["sortOrder"], { name: "academic_levels_sort_order" });
    await queryInterface.addIndex("courses", ["academicLevelId", "isPublic", "sortOrder"], { name: "courses_catalogue_filters" });
    await queryInterface.addIndex("course_tracks", ["availabilityStatus", "isPublic", "sortOrder"], { name: "course_tracks_catalogue_filters" });
    await queryInterface.addIndex("course_tracks", ["courseId", "mediumId"], { name: "course_tracks_course_medium_unique", unique: true });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("course_tracks", "course_tracks_course_medium_unique");
    await queryInterface.removeIndex("course_tracks", "course_tracks_catalogue_filters");
    await queryInterface.removeIndex("courses", "courses_catalogue_filters");
    await queryInterface.removeIndex("academic_levels", "academic_levels_sort_order");
    await queryInterface.removeColumn("course_tracks", "enrolmentOpen");
    await queryInterface.removeColumn("course_tracks", "isPublic");
    await queryInterface.removeColumn("course_tracks", "availabilityStatus");
    await queryInterface.removeColumn("media", "isActive");
    await queryInterface.removeColumn("media", "sortOrder");
    await queryInterface.removeColumn("media", "nameSi");
    await queryInterface.removeColumn("media", "nameEn");
    await queryInterface.removeColumn("courses", "publishedAt");
    await queryInterface.removeColumn("courses", "isPublic");
    await queryInterface.removeColumn("courses", "isFeatured");
    await queryInterface.removeColumn("courses", "shortDescriptionSi");
    await queryInterface.removeColumn("courses", "shortDescriptionEn");
    await queryInterface.removeColumn("courses", "titleSi");
    await queryInterface.removeColumn("courses", "titleEn");
    await queryInterface.removeColumn("courses", "academicLevelId");
    await queryInterface.dropTable("academic_levels");
  },
};
