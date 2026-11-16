"use strict";

const { randomUUID } = require("node:crypto");

const categories = [
  ["school-ict", "Grade 6–9 ICT", "published"],
  ["ol-ict", "O/L ICT", "published"],
  ["al-ict", "A/L ICT", "published"],
  ["degree", "Degree", "draft"],
  ["professional-certifications", "Professional Certifications", "draft"],
  ["short-courses", "Short Courses", "draft"],
];

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      for (const [index, [slug, name, status]] of categories.entries()) {
        await sequelize.query(
          `INSERT INTO categories (id, slug, name, status, sortOrder, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE name = VALUES(name), sortOrder = VALUES(sortOrder)`,
          { replacements: [randomUUID(), slug, name, status, index + 1], transaction },
        );
      }
      await sequelize.query(
        `UPDATE courses c
         JOIN categories school ON school.id = c.categoryId AND school.slug = 'school-ict'
         JOIN categories ol ON ol.slug = 'ol-ict'
         SET c.categoryId = ol.id
         WHERE c.courseGroup = 'OL'`,
        { transaction },
      );
    });
  },
  async down() {
    // Retain category records and relationships that may now be in use.
  },
};
