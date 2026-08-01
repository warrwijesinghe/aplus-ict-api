"use strict";

const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");

const levels = [
  ["GRADE_6", "Grade 6", "6 ශ්‍රේණිය", 6],
  ["GRADE_7", "Grade 7", "7 ශ්‍රේණිය", 7],
  ["GRADE_8", "Grade 8", "8 ශ්‍රේණිය", 8],
  ["GRADE_9", "Grade 9", "9 ශ්‍රේණිය", 9],
  ["GRADE_10", "Grade 10", "10 ශ්‍රේණිය", 10],
  ["GRADE_11", "Grade 11", "11 ශ්‍රේණිය", 11],
  ["AL", "Advanced Level", "උසස් පෙළ", 12],
];

const mediums = [
  ["sinhala", "Sinhala Medium", "සිංහල මාධ්‍ය", "si-LK", 1],
  ["english", "English Medium", "ඉංග්‍රීසි මාධ්‍ය", "en-LK", 2],
];

module.exports = {
  async up(queryInterface) {
    const db = queryInterface.sequelize;
    const now = new Date();
    const one = async (sql, replacements) => {
      const rows = await db.query(sql, { replacements, type: QueryTypes.SELECT });
      return rows[0];
    };

    for (const [code, nameEn, nameSi, sortOrder] of levels) {
      const existing = await one("SELECT id FROM academic_levels WHERE code = ?", [code]);
      if (!existing)
        await queryInterface.bulkInsert("academic_levels", [
          { id: randomUUID(), code, nameEn, nameSi, sortOrder, isActive: true, createdAt: now, updatedAt: now },
        ]);
    }

    for (const [code, nameEn, nameSi, locale, sortOrder] of mediums) {
      const existing = await one("SELECT id FROM media WHERE code = ?", [code]);
      if (!existing) {
        await queryInterface.bulkInsert("media", [
          { id: randomUUID(), code, name: nameEn, nameEn, nameSi, locale, sortOrder, isActive: true, createdAt: now, updatedAt: now },
        ]);
      } else {
        await db.query(
          "UPDATE media SET name = ?, nameEn = ?, nameSi = ?, locale = ?, sortOrder = ?, isActive = true, updatedAt = ? WHERE id = ?",
          { replacements: [nameEn, nameEn, nameSi, locale, sortOrder, now, existing.id] },
        );
      }
    }

    let schoolCategory = await one("SELECT id FROM categories WHERE slug = ?", ["school-ict"]);
    if (!schoolCategory) {
      schoolCategory = { id: randomUUID() };
      await queryInterface.bulkInsert("categories", [
        {
          id: schoolCategory.id,
          name: "School ICT",
          slug: "school-ict",
          description: "ICT learning paths for Grade 6 to Grade 11.",
          status: "published",
          sortOrder: 2,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }
    const alCategory = await one("SELECT id FROM categories WHERE slug = ?", ["al-ict"]);

    for (const [code, nameEn, nameSi, sortOrder] of levels) {
      const level = await one("SELECT id FROM academic_levels WHERE code = ?", [code]);
      const isAl = code === "AL";
      const slug = isAl ? "al-ict" : `${code.toLowerCase().replace("_", "-")}-ict`;
      let course = await one("SELECT id FROM courses WHERE slug = ?", [slug]);
      const titleEn = isAl ? "A/L Information and Communication Technology" : `${nameEn} ICT`;
      const titleSi = isAl ? "උසස් පෙළ තොරතුරු හා සන්නිවේදන තාක්ෂණය" : `${nameSi} ICT`;
      const shortDescriptionEn = isAl
        ? "Structured A/L ICT lessons with free chapters, notes, activities, and progress tracking."
        : `Upcoming ${nameEn} ICT learning paths for Sinhala and English-medium students.`;
      const shortDescriptionSi = isAl
        ? "නොමිලේ පාඩම්, සටහන්, ක්‍රියාකාරකම් සහ ප්‍රගති සටහන් සමඟ ව්‍යුහගත A/L ICT ඉගෙනුම."
        : `සිංහල සහ ඉංග්‍රීසි මාධ්‍ය සිසුන් සඳහා ඉදිරියේදී ලැබෙන ${nameSi} ICT ඉගෙනුම් මාර්ග.`;
      if (!course) {
        course = { id: randomUUID() };
        await queryInterface.bulkInsert("courses", [
          {
            id: course.id,
            categoryId: isAl ? alCategory?.id || schoolCategory.id : schoolCategory.id,
            academicLevelId: level.id,
            title: titleEn,
            titleEn,
            titleSi,
            slug,
            code: `${code}-ICT`,
            academicLevel: isAl ? "al" : "ol",
            description: shortDescriptionEn,
            shortDescriptionEn,
            shortDescriptionSi,
            status: "published",
            sortOrder,
            isFeatured: isAl,
            isPublic: true,
            publishedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      } else {
        await db.query(
          "UPDATE courses SET academicLevelId = ?, titleEn = ?, titleSi = ?, shortDescriptionEn = ?, shortDescriptionSi = ?, isFeatured = ?, isPublic = true, publishedAt = COALESCE(publishedAt, ?), updatedAt = ? WHERE id = ?",
          { replacements: [level.id, titleEn, titleSi, shortDescriptionEn, shortDescriptionSi, isAl, now, now, course.id] },
        );
      }

      for (const [mediumCode, mediumName, , , mediumSort] of mediums) {
        const medium = await one("SELECT id FROM media WHERE code = ?", [mediumCode]);
        const trackSlug = isAl
          ? `al-ict-${mediumCode}`
          : `${slug}-${mediumCode}`;
        let track = await one("SELECT id FROM course_tracks WHERE courseId = ? AND mediumId = ?", [course.id, medium.id]);
        if (!track) track = await one("SELECT id FROM course_tracks WHERE slug = ?", [trackSlug]);
        const trackValues = {
          title: `${titleEn} - ${mediumName}`,
          slug: trackSlug,
          status: "published",
          availabilityStatus: isAl ? "active" : "coming_soon",
          isPublic: true,
          enrolmentOpen: isAl,
          sortOrder: sortOrder * 10 + mediumSort,
          updatedAt: now,
        };
        if (!track) {
          await queryInterface.bulkInsert("course_tracks", [
            { id: randomUUID(), courseId: course.id, mediumId: medium.id, ...trackValues, createdAt: now },
          ]);
        } else {
          await db.query(
            "UPDATE course_tracks SET courseId = ?, mediumId = ?, title = ?, slug = ?, status = ?, availabilityStatus = ?, isPublic = ?, enrolmentOpen = ?, sortOrder = ?, updatedAt = ? WHERE id = ?",
            { replacements: [course.id, medium.id, trackValues.title, trackValues.slug, trackValues.status, trackValues.availabilityStatus, trackValues.isPublic, trackValues.enrolmentOpen, trackValues.sortOrder, now, track.id] },
          );
        }
      }
    }
  },
  async down() {
    // Catalogue seed rows are intentionally preserved. Removing them could delete
    // administrator-edited records or their future learner relationships.
  },
};
