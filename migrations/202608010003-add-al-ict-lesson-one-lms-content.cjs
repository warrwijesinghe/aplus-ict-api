"use strict";

const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");

const lessonOneContent = [
  {
    topic: {
      title: "Start here",
      titleEn: "Start here",
      titleSi: "ආරම්භය",
      descriptionEn: "Follow the activities in order. Mark each one complete after studying it.",
    },
    section: {
      type: "rich_text",
      title: "How to study this lesson",
      titleEn: "How to study this lesson",
      titleSi: "මෙම පාඩම හදාරන්නේ කෙසේද",
      descriptionEn: "A short guide before beginning the video lessons.",
      content: "Start with Data and Information, then continue to Basic Concepts of ICT. Pause when needed and note key definitions, examples, and differences.",
    },
  },
  {
    topic: {
      title: "Data and Information",
      titleEn: "Data and Information",
      titleSi: "දත්ත හා තොරතුරු",
      descriptionEn: "Learn the distinction between data and information, with the examples used in the lesson.",
    },
    section: {
      type: "video",
      title: "Video 1: Data and Information",
      titleEn: "Video 1: Data and Information",
      titleSi: "වීඩියෝ 1: දත්ත හා තොරතුරු",
      descriptionEn: "Watch the first Lesson 01 video, then record the key differences between data and information.",
      youtubeUrl: "https://youtu.be/fBoPKNSv3po",
      config: { provider: "youtube", display: "embedded" },
    },
  },
  {
    topic: {
      title: "Basic Concepts of ICT",
      titleEn: "Basic Concepts of ICT",
      titleSi: "මූලික ICT සංකල්ප",
      descriptionEn: "Build the foundation needed for the rest of the A/L ICT course.",
    },
    section: {
      type: "video",
      title: "Video 2: Basic Concepts of ICT",
      titleEn: "Video 2: Basic Concepts of ICT",
      titleSi: "වීඩියෝ 2: මූලික ICT සංකල්ප",
      descriptionEn: "Watch the second Lesson 01 video and identify the main ICT concepts introduced.",
      youtubeUrl: "https://youtu.be/6XVuJHHBHBA",
      config: { provider: "youtube", display: "embedded" },
    },
  },
];

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
    const existing = await queryInterface.sequelize.query(
      "SELECT id FROM lesson_sections WHERE lessonId = :lessonId AND youtubeUrl IN (:urls)",
      {
        replacements: {
          lessonId,
          urls: lessonOneContent.filter((item) => item.section.youtubeUrl).map((item) => item.section.youtubeUrl),
        },
        type: QueryTypes.SELECT,
      },
    );
    if (existing.length) return;

    const now = new Date();
    const existingTopics = await queryInterface.sequelize.query(
      "SELECT id, titleEn FROM topics WHERE lessonId = :lessonId AND titleEn IN (:titles)",
      {
        replacements: { lessonId, titles: lessonOneContent.map((item) => item.topic.titleEn) },
        type: QueryTypes.SELECT,
      },
    );
    const existingTopicIds = new Map(existingTopics.map((topic) => [topic.titleEn, topic.id]));
    const topics = lessonOneContent.map((item, index) => ({
      id: existingTopicIds.get(item.topic.titleEn) || randomUUID(),
      lessonId,
      ...item.topic,
      status: "published",
      sortOrder: index + 1,
      createdAt: now,
      updatedAt: now,
    }));
    const newTopics = topics.filter((topic) => !existingTopicIds.has(topic.titleEn));
    if (newTopics.length) await queryInterface.bulkInsert("topics", newTopics);
    await queryInterface.bulkInsert(
      "lesson_sections",
      lessonOneContent.map((item, index) => ({
        id: randomUUID(),
        lessonId,
        topicId: topics[index].id,
        ...item.section,
        config: item.section.config ? JSON.stringify(item.section.config) : null,
        accessPolicy: "free",
        sortOrder: index + 1,
        isVisible: true,
        status: "published",
        createdAt: now,
        updatedAt: now,
      })),
    );
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
    await queryInterface.bulkDelete("lesson_sections", {
      lessonId,
      youtubeUrl: ["https://youtu.be/fBoPKNSv3po", "https://youtu.be/6XVuJHHBHBA"],
    });
    await queryInterface.bulkDelete("topics", {
      lessonId,
      titleEn: ["Start here", "Data and Information", "Basic Concepts of ICT"],
    });
  },
};
