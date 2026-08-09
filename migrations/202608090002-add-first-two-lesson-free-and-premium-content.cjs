"use strict";

const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");

const legacyProductSlug = "sample-al-ict-sinhala-lesson-01-unlock";

const labelsFor = (lesson, isSinhala) => {
  const lessonTitle = lesson.titleEn || lesson.title;
  const number = String(lesson.lessonNumber).padStart(2, "0");
  if (isSinhala) return {
    freeTopic: `පාඩම ${number}: මූලික ඉගෙනීම`,
    paidTopic: `පාඩම ${number}: ප්‍රායෝගික පුහුණුව`,
    freeActivity: `${lessonTitle} — ආරම්භක මාර්ගෝපදේශය`,
    paidActivity: `${lessonTitle} — Premium පුහුණුව`,
    freeDescription: "මෙම පාඩමේ ප්‍රධාන සංකල්ප හඳුනාගෙන ඉගෙනීම ආරම්භ කරන්න.",
    paidDescription: "මෙම පාඩමේ සංකල්ප භාවිතයෙන් අමතර premium පුහුණුවක් කරන්න.",
    freeContent: "මෙම පාඩම ආරම්භ කිරීමට පෙර ප්‍රධාන සංකල්ප, පද සහ උදාහරණ හඳුනා ගන්න. ඉගෙනීම අතරතුර වැදගත් කරුණු සටහන් කරගන්න.",
    paidInstructions: "පාඩමේ ප්‍රධාන සංකල්ප නැවත සමාලෝචනය කර, සෑම සංකල්පයක් සඳහාම ඔබගේම උදාහරණයක් සටහන් කරන්න.",
    productName: `${lessonTitle} — සම්පූර්ණ පාඩම් ප්‍රවේශය`,
  };
  return {
    freeTopic: `Lesson ${number}: Foundation`,
    paidTopic: `Lesson ${number}: Guided practice`,
    freeActivity: `${lessonTitle} — Learning guide`,
    paidActivity: `${lessonTitle} — Guided practice`,
    freeDescription: "Identify the key ideas in this lesson before you continue.",
    paidDescription: "Apply this lesson's concepts in a guided premium practice activity.",
    freeContent: "Begin by identifying the key concepts, terms, and examples in this lesson. Keep notes on the ideas you need to remember as you learn.",
    paidInstructions: "Review the key concepts from this lesson, then write one example in your own words for each concept.",
    productName: `${lessonTitle} — Full lesson access`,
  };
};

module.exports = {
  async up(queryInterface) {
    const tracks = await queryInterface.sequelize.query(
      `SELECT course_tracks.id AS courseTrackId, course_tracks.courseId, course_tracks.slug AS trackSlug, media.code AS mediumCode
       FROM course_tracks
       INNER JOIN media ON media.id = course_tracks.mediumId
       WHERE course_tracks.status = 'published' AND course_tracks.isPublic = true`,
      { type: QueryTypes.SELECT },
    );

    for (const track of tracks) {
      const lessons = await queryInterface.sequelize.query(
        `SELECT id, slug, lessonNumber, title, titleEn
         FROM lessons
         WHERE trackId = :courseTrackId AND status = 'published'
         ORDER BY sortOrder ASC, lessonNumber ASC
         LIMIT 2`,
        { replacements: { courseTrackId: track.courseTrackId }, type: QueryTypes.SELECT },
      );

      for (const lesson of lessons) {
        const now = new Date();
        const isSinhala = track.mediumCode === "sinhala";
        const labels = labelsFor(lesson, isSinhala);
        const freeTopicSlug = `aplus-first-two-free-${lesson.lessonNumber}`;
        const paidTopicSlug = `aplus-first-two-premium-${lesson.lessonNumber}`;
        const topicRows = await queryInterface.sequelize.query(
          "SELECT id, slug FROM topics WHERE lessonId = :lessonId AND slug IN (:slugs)",
          { replacements: { lessonId: lesson.id, slugs: [freeTopicSlug, paidTopicSlug] }, type: QueryTypes.SELECT },
        );
        const topicIds = new Map(topicRows.map((topic) => [topic.slug, topic.id]));
        const freeTopicId = topicIds.get(freeTopicSlug) || randomUUID();
        const paidTopicId = topicIds.get(paidTopicSlug) || randomUUID();

        const topics = [
          { id: freeTopicId, lessonId: lesson.id, slug: freeTopicSlug, title: labels.freeTopic, titleEn: labels.freeTopic, titleSi: isSinhala ? labels.freeTopic : null, descriptionEn: labels.freeDescription, status: "published", sortOrder: 900, isVisible: true, createdAt: now, updatedAt: now },
          { id: paidTopicId, lessonId: lesson.id, slug: paidTopicSlug, title: labels.paidTopic, titleEn: labels.paidTopic, titleSi: isSinhala ? labels.paidTopic : null, descriptionEn: labels.paidDescription, status: "published", sortOrder: 901, isVisible: true, createdAt: now, updatedAt: now },
        ].filter((topic) => !topicIds.has(topic.slug));
        if (topics.length) await queryInterface.bulkInsert("topics", topics);

        const sectionRows = await queryInterface.sequelize.query(
          "SELECT id, titleEn FROM lesson_sections WHERE lessonId = :lessonId AND titleEn IN (:titles)",
          { replacements: { lessonId: lesson.id, titles: [labels.freeActivity, labels.paidActivity] }, type: QueryTypes.SELECT },
        );
        const existingSections = new Set(sectionRows.map((section) => section.titleEn));
        const sections = [
          { id: randomUUID(), lessonId: lesson.id, topicId: freeTopicId, type: "rich_text", title: labels.freeActivity, titleEn: labels.freeActivity, titleSi: isSinhala ? labels.freeActivity : null, descriptionEn: labels.freeDescription, content: labels.freeContent, accessPolicy: "free", completionMode: "view", estimatedMinutes: 5, sortOrder: 900, isVisible: true, status: "published", publishedAt: now, createdAt: now, updatedAt: now },
          { id: randomUUID(), lessonId: lesson.id, topicId: paidTopicId, type: "practical_activity", title: labels.paidActivity, titleEn: labels.paidActivity, titleSi: isSinhala ? labels.paidActivity : null, descriptionEn: labels.paidDescription, instructions: labels.paidInstructions, accessPolicy: "premium", completionMode: "manual", estimatedMinutes: 10, sortOrder: 901, isVisible: true, status: "published", publishedAt: now, createdAt: now, updatedAt: now },
        ].filter((section) => !existingSections.has(section.titleEn));
        if (sections.length) await queryInterface.bulkInsert("lesson_sections", sections);

        const productSlug = `${track.trackSlug}-${lesson.slug}-full-lesson-access`;
        const legacyProduct = track.trackSlug === "al-ict-sinhala" && lesson.slug === "concept-of-ict"
          ? await queryInterface.sequelize.query("SELECT id FROM products WHERE slug = :slug LIMIT 1", { replacements: { slug: legacyProductSlug }, type: QueryTypes.SELECT })
          : [];
        const publishedProducts = await queryInterface.sequelize.query(
          "SELECT id FROM products WHERE lessonId = :lessonId AND status IN ('published', 'active') ORDER BY publishedAt DESC LIMIT 1",
          { replacements: { lessonId: lesson.id }, type: QueryTypes.SELECT },
        );
        const productId = legacyProduct[0]?.id || publishedProducts[0]?.id || randomUUID();
        if (legacyProduct.length) {
          await queryInterface.bulkUpdate("products", { name: labels.productName, slug: productSlug, shortDescription: labels.paidDescription, description: `${labels.productName}.`, updatedAt: now }, { id: productId });
        } else if (!publishedProducts.length) {
          await queryInterface.bulkInsert("products", [{
            id: productId,
            productType: "lesson_exam_success_pack",
            lessonId: lesson.id,
            courseId: track.courseId,
            courseTrackId: track.courseTrackId,
            name: labels.productName,
            slug: productSlug,
            shortDescription: labels.paidDescription,
            description: `${labels.productName}.`,
            price: "0.00",
            currency: "LKR",
            status: "published",
            isFeatured: false,
            publishedAt: now,
            createdAt: now,
            updatedAt: now,
          }]);
        }

        const rules = await queryInterface.sequelize.query(
          "SELECT id FROM product_entitlement_rules WHERE productId = :productId AND lessonId = :lessonId LIMIT 1",
          { replacements: { productId, lessonId: lesson.id }, type: QueryTypes.SELECT },
        );
        if (!rules.length) await queryInterface.bulkInsert("product_entitlement_rules", [{
          id: randomUUID(),
          productId,
          entitlementType: "lesson_premium_access",
          courseId: track.courseId,
          courseTrackId: track.courseTrackId,
          lessonId: lesson.id,
          activityId: null,
          durationDays: null,
          createdAt: now,
          updatedAt: now,
        }]);
      }
    }
  },

  async down(queryInterface) {
    const topics = await queryInterface.sequelize.query(
      "SELECT id FROM topics WHERE slug REGEXP '^aplus-first-two-(free|premium)-[0-9]+$'",
      { type: QueryTypes.SELECT },
    );
    for (const topic of topics) {
      await queryInterface.bulkDelete("lesson_sections", { topicId: topic.id });
      await queryInterface.bulkDelete("topics", { id: topic.id });
    }
    // Products are intentionally retained. A product may have existed before
    // this migration, and removing a real catalogue item during rollback would
    // be unsafe. It can be unpublished through the product admin workflow.
  },
};
