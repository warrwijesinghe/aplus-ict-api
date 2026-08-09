"use strict";

const { QueryTypes } = require("sequelize");

const oldActivityTitle = "Sample locked activity: ICT concepts";
const newActivityCopy = {
  title: "ICT සංකල්ප — Premium practice",
  titleEn: "ICT සංකල්ප — Premium practice",
  titleSi: "ICT සංකල්ප — අමතර පුහුණුව",
  descriptionEn: "Unlock Lesson 01 to open this premium practice activity.",
  descriptionSi: "මෙම premium පුහුණු ක්‍රියාකාරකම විවෘත කිරීමට Lesson 01 unlock කරන්න.",
  content: "මෙය Lesson 01 සඳහා වන premium පුහුණු ක්‍රියාකාරකමකි.",
  instructions: "පාඩම unlock කළ පසු, ICT සංකල්ප නැවත සමාලෝචනය කර ඔබගේ අවබෝධය සටහන් කරන්න.",
};

module.exports = {
  async up(queryInterface) {
    const lessons = await queryInterface.sequelize.query(
      `SELECT lessons.id
       FROM lessons
       INNER JOIN course_tracks ON course_tracks.id = lessons.trackId
       WHERE course_tracks.slug = 'al-ict-sinhala' AND lessons.slug = 'concept-of-ict'
       LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    if (!lessons.length) return;
    const lessonId = lessons[0].id;
    await queryInterface.bulkUpdate("topics", {
      title: "Premium practice / අමතර පුහුණුව",
      titleEn: "Premium practice / අමතර පුහුණුව",
      titleSi: "අමතර පුහුණුව",
      descriptionEn: "Premium practice activity for this lesson.",
      descriptionSi: "මෙම පාඩම සඳහා අමතර premium පුහුණු ක්‍රියාකාරකමකි.",
      updatedAt: new Date(),
    }, { lessonId, slug: "sample-premium-practice" });
    await queryInterface.bulkUpdate("lesson_sections", { ...newActivityCopy, updatedAt: new Date() }, { lessonId, titleEn: oldActivityTitle });
  },

  async down(queryInterface) {
    const lessons = await queryInterface.sequelize.query(
      `SELECT lessons.id
       FROM lessons
       INNER JOIN course_tracks ON course_tracks.id = lessons.trackId
       WHERE course_tracks.slug = 'al-ict-sinhala' AND lessons.slug = 'concept-of-ict'
       LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    if (!lessons.length) return;
    const lessonId = lessons[0].id;
    await queryInterface.bulkUpdate("lesson_sections", {
      title: oldActivityTitle,
      titleEn: oldActivityTitle,
      titleSi: null,
      descriptionEn: "A test-only premium activity. Unlock Lesson 01 to open it.",
      descriptionSi: null,
      content: "This is sample premium content used only to test the locked-content and lesson-purchase flow.",
      instructions: "After unlocking, review the sample activity and mark it complete.",
      updatedAt: new Date(),
    }, { lessonId, titleEn: newActivityCopy.titleEn });
    await queryInterface.bulkUpdate("topics", {
      title: "Sample premium practice",
      titleEn: "Sample premium practice",
      titleSi: null,
      descriptionEn: "Test-only premium activity for verifying the lesson unlock journey.",
      descriptionSi: null,
      updatedAt: new Date(),
    }, { lessonId, slug: "sample-premium-practice" });
  },
};
