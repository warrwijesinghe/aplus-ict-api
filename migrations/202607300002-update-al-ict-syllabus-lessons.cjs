"use strict";
const { QueryTypes } = require("sequelize");

// This migration turns the initial generic "Lesson 1" records into the
// published A/L ICT syllabus for both learning media. The same list lives in
// the foundation seeder so fresh databases receive the final titles directly.
const syllabus = [
  {
    number: 1,
    periods: 28,
    slug: "concept-of-ict",
    english: {
      title: "Concept of ICT",
      summary: "Explore the role, value, and core concepts of information and communication technology.",
    },
    sinhala: {
      title: "තොරතුරු හා සන්නිවේදන තාක්ෂණය පිළිබඳ සංකල්ප",
      summary: "තොරතුරු හා සන්නිවේදන තාක්ෂණයේ මූලික සංකල්ප සහ භාවිතයන් හඳුනා ගන්න.",
    },
  },
  {
    number: 2,
    periods: 22,
    slug: "introduction-to-computer",
    english: {
      title: "Introduction to Computer",
      summary: "Understand the main parts of a computer system and how they work together.",
    },
    sinhala: {
      title: "පරිගණකය හැඳින්වීම",
      summary: "පරිගණක පද්ධතියක ප්‍රධාන කොටස් සහ ඒවා එක්ව ක්‍රියා කරන ආකාරය ඉගෙන ගන්න.",
    },
  },
  {
    number: 3,
    periods: 18,
    slug: "data-representation",
    english: {
      title: "Data Representation",
      summary: "Learn how text, numbers, images, and sound are represented inside a computer.",
    },
    sinhala: {
      title: "දත්ත නිරූපණය",
      summary: "අකුරු, සංඛ්‍යා, රූප සහ ශබ්ද පරිගණකය තුළ නිරූපණය වන ආකාරය ඉගෙන ගන්න.",
    },
  },
  {
    number: 4,
    periods: 26,
    slug: "fundamentals-of-digital-circuits",
    english: {
      title: "Fundamentals of Digital Circuits",
      summary: "Build a foundation in logic gates, Boolean operations, and digital circuit design.",
    },
    sinhala: {
      title: "අංකිත පරිපථවල මූලිකාංග",
      summary: "තාර්කික ද්වාර, බූලීය ක්‍රියා සහ අංකිත පරිපථවල මූලික සංකල්ප හදාරන්න.",
    },
  },
  {
    number: 5,
    periods: 22,
    slug: "computer-operating-systems",
    english: {
      title: "Computer Operating Systems",
      summary: "Discover how operating systems manage hardware, software, files, and users.",
    },
    sinhala: {
      title: "පරිගණක මෙහෙයුම් පද්ධති",
      summary: "දෘඩාංග, මෘදුකාංග, ගොනු සහ පරිශීලකයන් මෙහෙයුම් පද්ධතියක් කළමනාකරණය කරන ආකාරය හදාරන්න.",
    },
  },
  {
    number: 6,
    periods: 50,
    slug: "data-communication-and-networking",
    english: {
      title: "Data Communication and Networking",
      summary: "Understand networks, communication methods, devices, and the movement of data.",
    },
    sinhala: {
      title: "දත්ත සන්නිවේදනය හා ජාලකරණය",
      summary: "ජාල, සන්නිවේදන ක්‍රම, උපාංග සහ දත්ත ගමන් කරන ආකාරය තේරුම් ගන්න.",
    },
  },
  {
    number: 7,
    periods: 68,
    slug: "systems-analysis-and-design",
    english: {
      title: "Systems Analysis and Design",
      summary: "Plan, analyse, and design information systems that solve real-world problems.",
    },
    sinhala: {
      title: "පද්ධති විශ්ලේෂණය හා සැලසුම්කරණය",
      summary: "සත්‍ය ජීවිත ගැටලු සඳහා තොරතුරු පද්ධති සැලසුම් කිරීම සහ විශ්ලේෂණය කිරීම හදාරන්න.",
    },
  },
  {
    number: 8,
    periods: 50,
    slug: "database-management",
    english: {
      title: "Database Management",
      summary: "Organise, query, and manage data effectively with database concepts and tools.",
    },
    sinhala: {
      title: "දත්ත සමුදා කළමනාකරණය",
      summary: "දත්ත සමුදා සංකල්ප හා මෙවලම් භාවිතයෙන් දත්ත සංවිධානය, විමසුම සහ කළමනාකරණය ඉගෙන ගන්න.",
    },
  },
  {
    number: 9,
    periods: 74,
    slug: "programming",
    english: {
      title: "Programming",
      summary: "Develop problem-solving skills with algorithms, logic, and practical programming.",
    },
    sinhala: {
      title: "ක්‍රමලේඛනය",
      summary: "ඇල්ගොරිතම, තාර්කිකත්වය සහ ප්‍රායෝගික ක්‍රමලේඛනය භාවිතයෙන් ගැටලු විසඳීම දියුණු කරන්න.",
    },
  },
  {
    number: 10,
    periods: 60,
    slug: "web-development",
    english: {
      title: "Web Development",
      summary: "Create accessible, structured web experiences with modern web development concepts.",
    },
    sinhala: {
      title: "වෙබ් අඩවි සංවර්ධනය",
      summary: "නවීන වෙබ් සංවර්ධන සංකල්ප භාවිතයෙන් ව්‍යුහගත හා පහසු වෙබ් අත්දැකීම් නිර්මාණය කරන්න.",
    },
  },
  {
    number: 11,
    periods: 15,
    slug: "internet-of-things",
    english: {
      title: "Internet of Things",
      summary: "See how connected devices collect, communicate, and act on data in the real world.",
    },
    sinhala: {
      title: "දේව අන්තර්ජාලය",
      summary: "අන්තර්ජාලයට සම්බන්ධ උපාංග සත්‍ය ලෝකයේ දත්ත එකතු, හුවමාරු සහ භාවිත කරන ආකාරය හඳුනා ගන්න.",
    },
  },
  {
    number: 12,
    periods: 12,
    slug: "ict-in-business",
    english: {
      title: "ICT in Business",
      summary: "Learn how information technology supports modern organisations and business decisions.",
    },
    sinhala: {
      title: "ව්‍යාපාර තුළ තොරතුරු හා සන්නිවේදන තාක්ෂණය",
      summary: "නවීන සංවිධාන සහ ව්‍යාපාර තීරණ සඳහා තොරතුරු තාක්ෂණය සහාය වන ආකාරය හදාරන්න.",
    },
  },
  {
    number: 13,
    periods: 12,
    slug: "new-trends-and-future-directions-of-ict",
    english: {
      title: "New Trends and Future Directions of ICT",
      summary: "Explore emerging ICT trends, opportunities, and future directions in technology.",
    },
    sinhala: {
      title: "තොරතුරු හා සන්නිවේදන තාක්ෂණයේ නව නැඹුරු හා අනාගත දිශානති",
      summary: "නැගී එන තොරතුරු තාක්ෂණ නැඹුරු, අවස්ථා සහ අනාගත දිශානති පිළිබඳ අවබෝධයක් ලබා ගන්න.",
    },
  },
];

module.exports = {
  syllabus,
  async up(queryInterface, Sequelize) {
    // A failed migration can leave an added column behind before its data update
    // runs. Checking first makes this update safe to rerun in that situation.
    const lessonColumns = await queryInterface.describeTable("lessons");
    if (!lessonColumns.estimatedPeriods) {
      await queryInterface.addColumn("lessons", "estimatedPeriods", {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    const tracks = await queryInterface.sequelize.query(
      "SELECT id, slug FROM course_tracks WHERE slug IN ('al-ict-sinhala', 'al-ict-english')",
      { type: QueryTypes.SELECT },
    );
    const now = new Date();

    for (const track of tracks) {
      const medium = track.slug.endsWith("sinhala") ? "sinhala" : "english";
      for (const lesson of syllabus) {
        await queryInterface.bulkUpdate(
          "lessons",
          {
            title: lesson[medium].title,
            slug: lesson.slug,
            summary: lesson[medium].summary,
            estimatedPeriods: lesson.periods,
            updatedAt: now,
          },
          { trackId: track.id, lessonNumber: lesson.number },
        );
      }
    }
  },

  async down(queryInterface) {
    const tracks = await queryInterface.sequelize.query(
      "SELECT id FROM course_tracks WHERE slug IN ('al-ict-sinhala', 'al-ict-english')",
      { type: QueryTypes.SELECT },
    );
    const now = new Date();

    for (const track of tracks) {
      for (const lesson of syllabus) {
        await queryInterface.bulkUpdate(
          "lessons",
          {
            title: "Lesson " + lesson.number,
            slug: "lesson-" + lesson.number,
            summary: null,
            updatedAt: now,
          },
          { trackId: track.id, lessonNumber: lesson.number },
        );
      }
    }
    await queryInterface.removeColumn("lessons", "estimatedPeriods");
  },
};
