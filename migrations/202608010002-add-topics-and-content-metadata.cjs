"use strict";

const addIfMissing = async (queryInterface, table, column, definition) => {
  const columns = await queryInterface.describeTable(table);
  if (!columns[column]) await queryInterface.addColumn(table, column, definition);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("topics")) {
      await queryInterface.createTable("topics", {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        lessonId: { type: Sequelize.UUID, allowNull: false },
        title: Sequelize.STRING,
        titleEn: Sequelize.STRING,
        titleSi: Sequelize.STRING,
        descriptionEn: Sequelize.TEXT,
        descriptionSi: Sequelize.TEXT,
        status: { type: Sequelize.STRING, allowNull: false, defaultValue: "draft" },
        sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
      });
      await queryInterface.addIndex("topics", ["lessonId", "sortOrder"], { name: "topics_lesson_sort_order" });
    }
    await addIfMissing(queryInterface, "lesson_sections", "topicId", Sequelize.UUID);
    await addIfMissing(queryInterface, "lesson_sections", "titleEn", Sequelize.STRING);
    await addIfMissing(queryInterface, "lesson_sections", "titleSi", Sequelize.STRING);
    await addIfMissing(queryInterface, "lesson_sections", "descriptionEn", Sequelize.TEXT);
    await addIfMissing(queryInterface, "lesson_sections", "descriptionSi", Sequelize.TEXT);
    await addIfMissing(queryInterface, "lesson_sections", "status", { type: Sequelize.STRING, allowNull: false, defaultValue: "published" });
    await queryInterface.changeColumn("lesson_sections", "accessPolicy", { type: Sequelize.STRING, allowNull: false, defaultValue: "free" });
    await queryInterface.addIndex("lesson_sections", ["topicId", "sortOrder"], { name: "lesson_sections_topic_sort_order" });
    await queryInterface.addIndex("lesson_sections", ["lessonId", "status", "isVisible"], { name: "lesson_sections_public_filters" });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex("lesson_sections", "lesson_sections_public_filters");
    await queryInterface.removeIndex("lesson_sections", "lesson_sections_topic_sort_order");
    await queryInterface.removeColumn("lesson_sections", "status");
    await queryInterface.removeColumn("lesson_sections", "descriptionSi");
    await queryInterface.removeColumn("lesson_sections", "descriptionEn");
    await queryInterface.removeColumn("lesson_sections", "titleSi");
    await queryInterface.removeColumn("lesson_sections", "titleEn");
    await queryInterface.removeColumn("lesson_sections", "topicId");
    await queryInterface.dropTable("topics");
  },
};
