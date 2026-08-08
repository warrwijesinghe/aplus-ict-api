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

const catalogue = {
  GRADE_6: {
    english: ["Importance of Computers", "Use the Computer Laboratory Safely", "Operating System and File Management", "Using Mouse and Keyboard to Use Application Software", "Algorithms and Flowcharts", "Using the Internet for Collecting Information and Communication"],
    sinhala: ["පරිගණකයේ වැදගත්කම", "පරිගණක විද්‍යාගාරය ආරක්ෂිතව භාවිතය", "මෙහෙයුම් පද්ධතිය හා ගොනු හැසිරවීම", "යෙදුම් මෘදුකාංග භාවිතය සඳහා මූසිකය හා යතුරුපුවරුව යොදා ගැනීම", "ඇල්ගොරිතම සහ ගැලීම් සටහන්", "තොරතුරු රැස්කිරීම හා සන්නිවේදනය සඳහා අන්තර්ජාලය භාවිතය"],
  },
  GRADE_7: {
    english: ["Central Processing Unit", "Operating System", "Security of Computer System", "Word Processing", "Programme Development", "Presentation Software", "Using the Internet for Information and Communication"],
    sinhala: ["මධ්‍ය සැකසුම් ඒකකය", "මෙහෙයුම් පද්ධතිය", "පරිගණක පද්ධතියේ ආරක්ෂාව", "වදන් සැකසීම", "ක්‍රමලේඛ සංවර්ධනය", "සමර්පණ මෘදුකාංග", "තොරතුරු හා සන්නිවේදනය සඳහා අන්තර්ජාලය භාවිතය"],
  },
  GRADE_8: {
    english: ["Number Systems", "Configuring and Formatting a Computer", "Word Processing", "Programming", "Physical Computing", "Internet"],
    sinhala: ["සංඛ්‍යා පද්ධති", "මෙහෙයුම් පද්ධතිය භාවිතයෙන් පරිගණකයක් වින්‍යාස කිරීම සහ සීරුමාරු කිරීම", "වදන් සැකසීම", "ක්‍රමලේඛ ගොඩනැගීම", "භෞතික ආගණනය සඳහා මෘදුකාංග භාවිතය", "අන්තර්ජාලයේ සැරිසැරීම"],
  },
  GRADE_9: {
    english: ["Preparation of Computer Specifications", "Electronic Spreadsheets", "Programming", "Use of Microcontrollers", "Computer Networks", "ICT and Society"],
    sinhala: ["පරිගණක සහ පර්යන්ත උපාංග මිල දී ගැනීම සඳහා පිරිවිතර සැකසීම", "විද්‍යුත් පැතුරුම්පත්", "ක්‍රමලේඛ ගොඩනැගීම", "ක්ෂුද්‍ර පාලක භාවිතය", "පරිගණක ජාලකරණය", "තොරතුරු හා සන්නිවේදන තාක්ෂණය සහ සමාජය"],
  },
  GRADE_10: {
    english: ["Information and Communication Technology", "Fundamentals of a Computer System", "Data Representation Methods in the Computer System", "Logic Gates with Boolean Functions", "Operating Systems", "Word Processing", "Electronic Spreadsheets", "Electronic Presentations", "Database"],
    sinhala: ["තොරතුරු හා සන්නිවේදන තාක්ෂණය", "පරිගණකය හඳුනා ගැනීම", "පරිගණක පද්ධතියේ දත්ත නිරූපණයට භාවිත කරන ක්‍රම", "තාර්කික ද්වාර සමග බූලීය වීජ ගණිතය", "මෙහෙයුම් පද්ධති", "වදන් සැකසීම", "විද්‍යුත් පැතුරුම්පත්", "ඉලෙක්ට්‍රොනික සමර්පණ", "දත්ත සමුදාය"],
  },
  GRADE_11: {
    english: ["Programming", "System Development Life Cycle", "The Internet and Electronic Mail", "Use of Multimedia", "Web Designing Using Multimedia", "Information and Communication Technology and Society"],
    sinhala: ["ගැටලු විසඳීමට ක්‍රමලේඛ ලිවීම", "තොරතුරු පද්ධති සංවර්ධන ක්‍රියාවලිය", "අන්තර්ජාලය හා විද්‍යුත් තැපෑල", "බහුමාධ්‍ය භාවිතය", "බහුමාධ්‍ය තාක්ෂණය යොදා ගනිමින් සරල වෙබ් අඩවි නිර්මාණය", "සමාජය සහ තොරතුරු හා සන්නිවේදන තාක්ෂණය"],
  },
};

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
      const courseGroup = isAl ? "AL" : Number(code.slice(6)) >= 10 ? "OL" : "SCHOOL";
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
            courseGroup,
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
          "UPDATE courses SET academicLevelId = ?, courseGroup = ?, titleEn = ?, titleSi = ?, shortDescriptionEn = ?, shortDescriptionSi = ?, isFeatured = ?, isPublic = true, publishedAt = COALESCE(publishedAt, ?), updatedAt = ? WHERE id = ?",
          { replacements: [level.id, courseGroup, titleEn, titleSi, shortDescriptionEn, shortDescriptionSi, isAl, now, now, course.id] },
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
          availabilityStatus: "active",
          isPublic: true,
          enrolmentOpen: true,
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

        if (!isAl) {
          const currentTrack = await one("SELECT id FROM course_tracks WHERE slug = ?", [trackSlug]);
          const lessons = catalogue[code][mediumCode];
          for (const [index, title] of lessons.entries()) {
            const lessonNumber = index + 1;
            const lessonSlug = `lesson-${String(lessonNumber).padStart(2, "0")}`;
            const existingLesson = await one(
              "SELECT id FROM lessons WHERE trackId = ? AND slug = ?",
              [currentTrack.id, lessonSlug],
            );
            const values = [title, lessonNumber, lessonNumber, now];
            if (!existingLesson) {
              await queryInterface.bulkInsert("lessons", [{
                id: randomUUID(), trackId: currentTrack.id, title, slug: lessonSlug,
                lessonNumber, estimatedPeriods: null, summary: null, accessPolicy: "free",
                status: "published", sortOrder: lessonNumber, createdAt: now, updatedAt: now,
              }]);
            } else {
              await db.query(
                "UPDATE lessons SET title = ?, lessonNumber = ?, sortOrder = ?, updatedAt = ? WHERE id = ?",
                { replacements: [...values, existingLesson.id] },
              );
            }
          }
        }
      }
    }
  },
  async down() {
    // Catalogue seed rows are intentionally preserved. Removing them could delete
    // administrator-edited records or their future learner relationships.
  },
};
