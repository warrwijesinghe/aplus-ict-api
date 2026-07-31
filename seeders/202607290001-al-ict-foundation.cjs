"use strict";
const { randomUUID } = require("crypto");
// The migration owns the final syllabus snapshot. Reusing it here keeps new
// databases aligned with the live catalogue without duplicating 26 lesson titles.
const { syllabus } = require("../migrations/202607300002-update-al-ict-syllabus-lessons.cjs");

module.exports = {
  async up(q) {
    const now = new Date(),
      categoryId = randomUUID(),
      courseId = randomUUID(),
      sinhala = randomUUID(),
      english = randomUUID(),
      tracks = [
        {
          id: randomUUID(),
          mediumId: sinhala,
          title: "A/L ICT - Sinhala Medium",
          slug: "al-ict-sinhala",
        },
        {
          id: randomUUID(),
          mediumId: english,
          title: "A/L ICT - English Medium",
          slug: "al-ict-english",
        },
      ];
    await q.bulkInsert("categories", [
      {
        id: categoryId,
        name: "A/L ICT",
        slug: "al-ict",
        description: "Advanced Level Information and Communication Technology",
        status: "published",
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await q.bulkInsert("courses", [
      {
        id: courseId,
        categoryId,
        title: "A/L Information and Communication Technology",
        slug: "al-ict",
        code: "AL-ICT",
        academicLevel: "al",
        status: "published",
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await q.bulkInsert("media", [
      {
        id: sinhala,
        code: "sinhala",
        name: "Sinhala Medium",
        locale: "si-LK",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: english,
        code: "english",
        name: "English Medium",
        locale: "en-LK",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await q.bulkInsert(
      "course_tracks",
      tracks.map((t, i) => ({
        ...t,
        courseId,
        status: "published",
        sortOrder: i + 1,
        createdAt: now,
        updatedAt: now,
      })),
    );
    const lessons = tracks.flatMap((track) => {
      const medium = track.slug.endsWith("sinhala") ? "sinhala" : "english";
      return syllabus.map((lesson) => ({
        id: randomUUID(),
        trackId: track.id,
        title: lesson[medium].title,
        slug: lesson.slug,
        lessonNumber: lesson.number,
        estimatedPeriods: lesson.periods,
        summary: lesson[medium].summary,
        accessPolicy: lesson.number === 1 ? "free" : "paid",
        status: "published",
        sortOrder: lesson.number,
        createdAt: now,
        updatedAt: now,
      }));
    });
    await q.bulkInsert("lessons", lessons);
  },
  async down(q) {
    await q.bulkDelete("lessons", null, {});
    await q.bulkDelete("course_tracks", null, {});
    await q.bulkDelete("media", null, {});
    await q.bulkDelete("courses", null, {});
    await q.bulkDelete("categories", null, {});
  },
};
