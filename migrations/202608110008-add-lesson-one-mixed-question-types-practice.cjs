"use strict";

const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");

const topicSlug = "lesson-01-question-types-practice";
const quizTitle = "පාඩම 01 — මිශ්‍ර ප්‍රශ්න වර්ග පුහුණුව (ප්‍රශ්න 10)";
const categorySlug = "lesson-01-mixed-question-types";
const questions = [
  { type: "multiple_choice", text: "ආදාන උපකරණ දෙකක් තෝරන්න.", options: [["යතුරු පුවරුව", true], ["මවුසය", true], ["තිරය", false], ["ප්‍රින්ටරය", false]] },
  { type: "true_false", text: "දත්ත සැකසීමෙන් තොරතුරු ලබා ගත හැක.", options: [["සත්‍ය", true], ["අසත්‍ය", false]] },
  { type: "matching", text: "උපකරණය එහි නිවැරදි කාර්යයට ගළපන්න.", pairs: [["යතුරු පුවරුව", "අකුරු සහ අංක ඇතුළත් කිරීම"], ["තිරය", "ප්‍රතිඵල පෙන්වීම"]] },
  { type: "short_answer", text: "පරිගණකයේ ප්‍රධාන සැකසුම් ඒකකයේ කෙටි නාමය ලියන්න.", answers: ["CPU", "Central Processing Unit"] },
  { type: "numeric", text: "පන්ති ලකුණු 60 සහ 80 නම් සාමාන්‍ය ලකුණ කීයද?", numeric: "70" },
  { type: "multiple_choice", text: "හොඳ තොරතුරක ලක්ෂණ දෙකක් තෝරන්න.", options: [["නිවැරදි වීම", true], ["අදාළ වීම", true], ["යල් පැන ගිය වීම", false], ["අපැහැදිලි වීම", false]] },
  { type: "true_false", text: "RAM යනු ස්ථිර ගබඩා මතකයකි.", options: [["සත්‍ය", false], ["අසත්‍ය", true]] },
  { type: "matching", text: "මෘදුකාංග වර්ගය උදාහරණයට ගළපන්න.", pairs: [["මෙහෙයුම් පද්ධතිය", "Windows"], ["වචන සැකසුම් මෘදුකාංගය", "Microsoft Word"]] },
  { type: "short_answer", text: "වෙබ් පිටුවක ලිපිනය හඳුන්වන කෙටි යෙදුම ලියන්න.", answers: ["URL", "Uniform Resource Locator"] },
  { type: "numeric", text: "ප්‍රශ්න 10කින් 6කට නිවැරදි පිළිතුරු දුන්නේ නම් ප්‍රතිශතය කීයද?", numeric: "60" }
];

module.exports = {
  async up(queryInterface) {
    const database = queryInterface.sequelize, now = new Date();
    await database.transaction(async (transaction) => {
      const one = async (sql, replacements = []) => (await database.query(sql, { replacements, type: QueryTypes.SELECT, transaction }))[0];
      const track = await one("SELECT id, courseId FROM course_tracks WHERE slug = ?", ["al-ict-sinhala"]);
      const lesson = track && await one("SELECT id FROM lessons WHERE trackId = ? AND lessonNumber = 1", [track.id]);
      const author = await one("SELECT id FROM users WHERE role IN ('super_admin', 'admin', 'content_editor', 'teacher') AND status = 'active' ORDER BY createdAt ASC LIMIT 1");
      if (!track || !lesson || !author) throw new Error("A/L ICT Sinhala Lesson 01 and an active author are required");
      await database.query("UPDATE topics SET sortOrder = 903 WHERE lessonId = ? AND slug = 'lesson-01-final-test'", { replacements: [lesson.id], transaction });
      let topic = await one("SELECT id FROM topics WHERE lessonId = ? AND slug = ?", [lesson.id, topicSlug]);
      if (!topic) { topic = { id: randomUUID() }; await queryInterface.bulkInsert("topics", [{ id: topic.id, lessonId: lesson.id, slug: topicSlug, title: "පාඩම 01 — මිශ්‍ර ප්‍රශ්න පුහුණුව", titleEn: "Lesson 01 Mixed Question Types Practice", titleSi: "පාඩම 01 — මිශ්‍ර ප්‍රශ්න පුහුණුව", descriptionEn: "Practice the question types used in online quizzes.", descriptionSi: "මාර්ගගත ප්‍රශ්නාවලිවල භාවිත වන විවිධ ප්‍රශ්න වර්ග පුහුණු කරන්න.", status: "published", sortOrder: 902, isVisible: true, createdAt: now, updatedAt: now }], { transaction }); }
      let activity = await one("SELECT id FROM lesson_sections WHERE lessonId = ? AND titleSi = ?", [lesson.id, quizTitle]);
      if (!activity) { activity = { id: randomUUID() }; await queryInterface.bulkInsert("lesson_sections", [{ id: activity.id, lessonId: lesson.id, topicId: topic.id, type: "quiz", title: quizTitle, titleEn: "Lesson 01 Mixed Question Types Practice", titleSi: quizTitle, descriptionEn: "A 10-question practice quiz with multiple question types.", descriptionSi: "විවිධ ප්‍රශ්න වර්ග අඩංගු ප්‍රශ්න 10ක පුහුණු ප්‍රශ්නාවලියකි.", instructions: "සෑම ප්‍රශ්නයකටම පිළිතුරු සපයන්න.", accessPolicy: "free", completionMode: "submit", estimatedMinutes: 15, maxScore: 10, passingScore: 6, sortOrder: 1, isVisible: true, status: "published", publishedAt: now, createdAt: now, updatedAt: now }], { transaction }); }
      let quiz = await one("SELECT id FROM quizzes WHERE lessonSectionId = ?", [activity.id]);
      if (!quiz) { quiz = { id: randomUUID() }; await queryInterface.bulkInsert("quizzes", [{ id: quiz.id, lessonSectionId: activity.id, courseId: track.courseId, courseTrackId: track.id, lessonId: lesson.id, topicId: topic.id, title: quizTitle, description: "විවිධ ප්‍රශ්න වර්ග අඩංගු ප්‍රශ්න 10ක පුහුණු ප්‍රශ්නාවලියකි.", instructions: "සෑම ප්‍රශ්නයකටම පිළිතුරු සපයන්න.", status: "published", attemptsAllowed: 3, passPercentage: 60, shuffleQuestions: false, shuffleOptions: false, gradingMethod: "highest", feedbackMode: "after_submission", showCorrectAnswers: true, showScore: true, showExplanations: true, completionRequiresPass: false, createdByUserId: author.id, updatedByUserId: author.id, publishedAt: now, createdAt: now, updatedAt: now }], { transaction }); }
      let category = await one("SELECT id FROM question_categories WHERE courseTrackId = ? AND slug = ?", [track.id, categorySlug]);
      if (!category) { category = { id: randomUUID() }; await queryInterface.bulkInsert("question_categories", [{ id: category.id, courseId: track.courseId, courseTrackId: track.id, lessonId: lesson.id, topicId: topic.id, name: "පාඩම 01 — මිශ්‍ර ප්‍රශ්න වර්ග", slug: categorySlug, description: "Mixed question-type practice questions.", status: "published", sortOrder: 902, createdByUserId: author.id, updatedByUserId: author.id, createdAt: now, updatedAt: now }], { transaction }); }
      for (const [index, item] of questions.entries()) {
        let question = await one("SELECT id FROM questions WHERE questionCategoryId = ? AND questionText = ?", [category.id, item.text]);
        if (!question) { question = { id: randomUUID() }; await queryInterface.bulkInsert("questions", [{ id: question.id, questionCategoryId: category.id, courseId: track.courseId, courseTrackId: track.id, lessonId: lesson.id, topicId: topic.id, questionType: item.type, title: `ප්‍රශ්නය ${index + 1}`, questionText: item.text, questionTextFormat: "html", difficulty: "easy", defaultMarks: 1, explanation: "මෙය මිශ්‍ර ප්‍රශ්න වර්ග පුහුණුව සඳහා වූ ආදර්ශ ප්‍රශ්නයකි.", status: "published", version: 1, createdByUserId: author.id, updatedByUserId: author.id, publishedAt: now, createdAt: now, updatedAt: now }], { transaction });
          if (item.options) await queryInterface.bulkInsert("question_options", item.options.map(([optionText, isCorrect], optionIndex) => ({ id: randomUUID(), questionId: question.id, optionText, optionTextFormat: "html", isCorrect, sortOrder: optionIndex + 1, createdAt: now, updatedAt: now })), { transaction });
          if (item.pairs) await queryInterface.bulkInsert("question_matching_pairs", item.pairs.map(([promptText, matchText], pairIndex) => ({ id: randomUUID(), questionId: question.id, promptText, matchText, sortOrder: pairIndex + 1, createdAt: now, updatedAt: now })), { transaction });
          if (item.answers) await queryInterface.bulkInsert("question_accepted_answers", item.answers.map((answerText, answerIndex) => ({ id: randomUUID(), questionId: question.id, answerText, isCaseSensitive: false, matchMode: "normalized", weight: 1, sortOrder: answerIndex + 1, createdAt: now, updatedAt: now })), { transaction });
          if (item.numeric) await queryInterface.bulkInsert("question_numeric_answers", [{ id: randomUUID(), questionId: question.id, answerValue: item.numeric, toleranceType: "absolute", toleranceValue: 0, minimumValue: null, maximumValue: null, unit: null, createdAt: now, updatedAt: now }], { transaction });
        }
        if (!await one("SELECT id FROM quiz_questions WHERE quizId = ? AND questionId = ?", [quiz.id, question.id])) await queryInterface.bulkInsert("quiz_questions", [{ id: randomUUID(), quizId: quiz.id, questionId: question.id, marks: 1, sortOrder: index + 1, isRequired: true, createdAt: now, updatedAt: now }], { transaction });
      }
    });
  },
  async down(queryInterface) {
    const database = queryInterface.sequelize;
    await database.transaction(async (transaction) => {
      const category = (await database.query("SELECT id FROM question_categories WHERE slug = ?", { replacements: [categorySlug], type: QueryTypes.SELECT, transaction }))[0];
      if (category) { const questionIds = (await database.query("SELECT id FROM questions WHERE questionCategoryId = ?", { replacements: [category.id], type: QueryTypes.SELECT, transaction })).map((row) => row.id); if (questionIds.length) { await queryInterface.bulkDelete("quiz_questions", { questionId: questionIds }, { transaction }); await queryInterface.bulkDelete("question_options", { questionId: questionIds }, { transaction }); await queryInterface.bulkDelete("question_matching_pairs", { questionId: questionIds }, { transaction }); await queryInterface.bulkDelete("question_accepted_answers", { questionId: questionIds }, { transaction }); await queryInterface.bulkDelete("question_numeric_answers", { questionId: questionIds }, { transaction }); await queryInterface.bulkDelete("questions", { id: questionIds }, { transaction }); } await queryInterface.bulkDelete("question_categories", { id: category.id }, { transaction }); }
      const activities = await database.query("SELECT id FROM lesson_sections WHERE titleSi = ?", { replacements: [quizTitle], type: QueryTypes.SELECT, transaction }); const ids = activities.map((row) => row.id); if (ids.length) { await queryInterface.bulkDelete("quizzes", { lessonSectionId: ids }, { transaction }); await queryInterface.bulkDelete("lesson_sections", { id: ids }, { transaction }); }
      await queryInterface.bulkDelete("topics", { slug: topicSlug }, { transaction });
    });
  }
};
