"use strict";

const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");

const sampleTopic = {
  slug: "sample-premium-practice",
  title: "Premium practice / අමතර පුහුණුව",
  titleEn: "Premium practice / අමතර පුහුණුව",
  titleSi: "අමතර පුහුණුව",
  descriptionEn: "Premium practice activity for this lesson.",
  descriptionSi: "මෙම පාඩම සඳහා අමතර premium පුහුණු ක්‍රියාකාරකමකි.",
};

const sampleSection = {
  type: "practical_activity",
  title: "ICT සංකල්ප — Premium practice",
  titleEn: "ICT සංකල්ප — Premium practice",
  titleSi: "ICT සංකල්ප — අමතර පුහුණුව",
  descriptionEn: "Unlock Lesson 01 to open this premium practice activity.",
  descriptionSi: "මෙම premium පුහුණු ක්‍රියාකාරකම විවෘත කිරීමට Lesson 01 unlock කරන්න.",
  content: "මෙය Lesson 01 සඳහා වන premium පුහුණු ක්‍රියාකාරකමකි.",
  instructions: "පාඩම unlock කළ පසු, ICT සංකල්ප නැවත සමාලෝචනය කර ඔබගේ අවබෝධය සටහන් කරන්න.",
  accessPolicy: "premium",
  completionMode: "manual",
  estimatedMinutes: 5,
  sortOrder: 1,
  isVisible: true,
  status: "published",
};

const productSlug = "sample-al-ict-sinhala-lesson-01-unlock";

module.exports = {
  async up(queryInterface) {
    const matches = await queryInterface.sequelize.query(
      `SELECT lessons.id AS lessonId, course_tracks.id AS courseTrackId, course_tracks.courseId AS courseId
       FROM lessons
       INNER JOIN course_tracks ON course_tracks.id = lessons.trackId
       WHERE course_tracks.slug = 'al-ict-sinhala' AND lessons.slug = 'concept-of-ict'
       LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    if (!matches.length) return;

    const { lessonId, courseTrackId, courseId } = matches[0];
    const now = new Date();
    const existingTopics = await queryInterface.sequelize.query(
      "SELECT id FROM topics WHERE lessonId = :lessonId AND slug = :slug LIMIT 1",
      { replacements: { lessonId, slug: sampleTopic.slug }, type: QueryTypes.SELECT },
    );
    const topicId = existingTopics[0]?.id || randomUUID();
    if (!existingTopics.length) {
      await queryInterface.bulkInsert("topics", [{
        id: topicId,
        lessonId,
        ...sampleTopic,
        status: "published",
        sortOrder: 99,
        isVisible: true,
        createdAt: now,
        updatedAt: now,
      }]);
    }

    const existingSections = await queryInterface.sequelize.query(
      "SELECT id FROM lesson_sections WHERE lessonId = :lessonId AND titleEn = :title LIMIT 1",
      { replacements: { lessonId, title: sampleSection.titleEn }, type: QueryTypes.SELECT },
    );
    if (!existingSections.length) {
      await queryInterface.bulkInsert("lesson_sections", [{
        id: randomUUID(),
        lessonId,
        topicId,
        ...sampleSection,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      }]);
    }

    const existingProducts = await queryInterface.sequelize.query(
      "SELECT id FROM products WHERE slug = :slug LIMIT 1",
      { replacements: { slug: productSlug }, type: QueryTypes.SELECT },
    );
    const productId = existingProducts[0]?.id || randomUUID();
    if (!existingProducts.length) {
      await queryInterface.bulkInsert("products", [{
        id: productId,
        productType: "lesson_exam_success_pack",
        lessonId,
        courseId,
        courseTrackId,
        name: "Sample: A/L ICT Lesson 01 unlock",
        slug: productSlug,
        shortDescription: "Test-only product for the A/L ICT Sinhala Lesson 01 unlock flow.",
        description: "This sample product unlocks the sample premium activity in Lesson 01. Set a real price and replace the sample content before publishing to students.",
        price: "0.00",
        currency: "LKR",
        status: "published",
        isFeatured: false,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      }]);
    }

    const existingRules = await queryInterface.sequelize.query(
      "SELECT id FROM product_entitlement_rules WHERE productId = :productId AND lessonId = :lessonId LIMIT 1",
      { replacements: { productId, lessonId }, type: QueryTypes.SELECT },
    );
    if (!existingRules.length) {
      await queryInterface.bulkInsert("product_entitlement_rules", [{
        id: randomUUID(),
        productId,
        entitlementType: "lesson_premium_access",
        courseId,
        courseTrackId,
        lessonId,
        activityId: null,
        durationDays: null,
        createdAt: now,
        updatedAt: now,
      }]);
    }
  },

  async down(queryInterface) {
    const products = await queryInterface.sequelize.query(
      "SELECT id FROM products WHERE slug = :slug LIMIT 1",
      { replacements: { slug: productSlug }, type: QueryTypes.SELECT },
    );
    if (products.length) {
      await queryInterface.bulkDelete("product_entitlement_rules", { productId: products[0].id });
      await queryInterface.bulkDelete("products", { id: products[0].id });
    }

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
    await queryInterface.bulkDelete("lesson_sections", { lessonId, titleEn: [sampleSection.titleEn, "Sample locked activity: ICT concepts"] });
    await queryInterface.bulkDelete("topics", { lessonId, slug: sampleTopic.slug });
  },
};
