"use strict";

const { randomUUID } = require("crypto");
const { QueryTypes } = require("sequelize");

const quizTitle = "දත්ත සහ තොරතුරු — බහුවරණ ප්‍රශ්නාවලිය";
const questions = [
  {
    text: "දත්ත යනු කුමක්ද?",
    options: ["සැකසූ කරුණු", "අමු කරුණු සහ සංඛ්‍යා", "අවසාන වාර්තාවක්", "ප්‍රයෝජනවත් දැනුම"],
    correct: 1,
    explanation: "දත්ත යනු තවමත් අර්ථවත් ආකාරයකට සකසා නොමැති අමු කරුණු සහ සංඛ්‍යා වේ."
  },
  {
    text: "පහත සඳහන් දේවලින් තොරතුරු සඳහා උදාහරණයක් වන්නේ කුමක්ද?",
    options: ["65, 72, 80, 55", "සිසුන්ගේ නම්", "පන්තියේ සාමාන්‍ය ලකුණ 68 වේ.", "උෂ්ණත්ව ලැයිස්තුවක්"],
    correct: 2,
    explanation: "සාමාන්‍ය ලකුණ සකස් කළ දත්තයක අර්ථවත් ප්‍රතිඵලයකි."
  },
  {
    text: "දත්ත සැකසූ විට කුමක් සිදු වේද?",
    options: ["එය දෘඩාංග බවට පත් වේ.", "එය තොරතුරු බවට පත් වේ.", "එය වැඩසටහනක් බවට පත් වේ.", "එය ගබඩාවක් බවට පත් වේ."],
    correct: 1,
    explanation: "දත්ත සකස් කිරීමෙන් අර්ථවත්, භාවිත කළ හැකි තොරතුරු ලැබේ."
  },
  {
    text: "මූලික තොරතුරු සැකසුම් චක්‍රය නිවැරදිව දැක්වෙන්නේ කුමන අනුපිළිවෙලින්ද?",
    options: ["ප්‍රතිදානය → ආදානය → සැකසුම", "සැකසුම → ආදානය → ප්‍රතිදානය", "ආදානය → සැකසුම → ප්‍රතිදානය", "ආදානය → ප්‍රතිදානය → සැකසුම"],
    correct: 2,
    explanation: "දත්ත ආදානය කර, එය සකස් කර, ප්‍රතිදානය ලෙස තොරතුරු ලබා ගනී."
  },
  {
    text: "හොඳ තොරතුරක ලක්ෂණයක් වන්නේ කුමක්ද?",
    options: ["එය සෑම විටම බොහෝ විස්තර අඩංගු විය යුතුය.", "එය නිරවද්‍ය හා අදාළ විය යුතුය.", "එය තේරුම් ගැනීමට අපහසු විය යුතුය.", "එය සංඛ්‍යා පමණක් අඩංගු විය යුතුය."],
    correct: 1,
    explanation: "හොඳ තොරතුරු නිරවද්‍ය, අදාළ සහ භාවිතයට සුදුසු විය යුතුය."
  }
];

module.exports = {
  async up(queryInterface) {
    const database = queryInterface.sequelize;
    const now = new Date();
    await database.transaction(async (transaction) => {
      const one = async (sql, replacements) => (await database.query(sql, {
        replacements,
        type: QueryTypes.SELECT,
        transaction
      }))[0];
      const track = await one("SELECT id, courseId FROM course_tracks WHERE slug = ?", ["al-ict-sinhala"]);
      if (!track) throw new Error("The A/L ICT Sinhala track is required before the Data and Information quiz can be added");
      const lesson = await one("SELECT id FROM lessons WHERE trackId = ? AND lessonNumber = 1", [track.id]);
      if (!lesson) throw new Error("Lesson 01 is required before the Data and Information quiz can be added");
      const author = await one("SELECT id FROM users WHERE role IN ('super_admin', 'admin', 'content_editor', 'teacher') AND status = 'active' ORDER BY createdAt ASC LIMIT 1");
      if (!author) throw new Error("An active content author is required before the Data and Information quiz can be added");

      let activity = await one("SELECT id FROM lesson_sections WHERE lessonId = ? AND type = 'quiz' AND titleSi = ?", [lesson.id, quizTitle]);
      if (!activity) {
        const maxOrder = await one("SELECT COALESCE(MAX(sortOrder), 0) AS maxOrder FROM lesson_sections WHERE lessonId = ?", [lesson.id]);
        activity = { id: randomUUID() };
        await queryInterface.bulkInsert("lesson_sections", [{
          id: activity.id,
          lessonId: lesson.id,
          type: "quiz",
          title: quizTitle,
          titleEn: "Data and Information — Multiple Choice Quiz",
          titleSi: quizTitle,
          descriptionEn: "A five-question self-assessment for Data and Information.",
          descriptionSi: "දත්ත සහ තොරතුරු පාඩම සඳහා ප්‍රශ්න පහක ස්වයං ඇගයීමකි.",
          instructions: "සෑම ප්‍රශ්නයකටම වඩාත් නිවැරදි පිළිතුර තෝරන්න.",
          accessPolicy: "free",
          completionMode: "submit",
          estimatedMinutes: 5,
          maxScore: 5,
          passingScore: 3,
          sortOrder: Number(maxOrder.maxOrder) + 1,
          isVisible: true,
          status: "published",
          publishedAt: now,
          createdAt: now,
          updatedAt: now
        }], { transaction });
      }

      let quiz = await one("SELECT id FROM quizzes WHERE lessonSectionId = ?", [activity.id]);
      if (!quiz) {
        quiz = { id: randomUUID() };
        await queryInterface.bulkInsert("quizzes", [{
          id: quiz.id,
          lessonSectionId: activity.id,
          courseId: track.courseId,
          courseTrackId: track.id,
          lessonId: lesson.id,
          topicId: null,
          title: quizTitle,
          description: "දත්ත සහ තොරතුරු පාඩම සඳහා බහුවරණ ප්‍රශ්නාවලියකි.",
          instructions: "සෑම ප්‍රශ්නයකටම වඩාත් නිවැරදි පිළිතුර තෝරන්න.",
          status: "published",
          attemptsAllowed: 3,
          passPercentage: 60,
          shuffleQuestions: false,
          shuffleOptions: false,
          gradingMethod: "highest",
          feedbackMode: "after_submission",
          showCorrectAnswers: true,
          showScore: true,
          showExplanations: true,
          completionRequiresPass: false,
          createdByUserId: author.id,
          updatedByUserId: author.id,
          publishedAt: now,
          createdAt: now,
          updatedAt: now
        }], { transaction });
      }

      let category = await one("SELECT id FROM question_categories WHERE courseTrackId = ? AND lessonId = ? AND slug = ?", [track.id, lesson.id, "data-information-mcq"]);
      if (!category) {
        category = { id: randomUUID() };
        await queryInterface.bulkInsert("question_categories", [{
          id: category.id,
          courseId: track.courseId,
          courseTrackId: track.id,
          lessonId: lesson.id,
          topicId: null,
          parentCategoryId: null,
          name: "දත්ත සහ තොරතුරු — MCQ",
          slug: "data-information-mcq",
          description: "Lesson 01 Data and Information multiple-choice questions.",
          status: "published",
          sortOrder: 1,
          createdByUserId: author.id,
          updatedByUserId: author.id,
          createdAt: now,
          updatedAt: now
        }], { transaction });
      }

      for (const [index, item] of questions.entries()) {
        let question = await one("SELECT id FROM questions WHERE questionCategoryId = ? AND questionText = ?", [category.id, item.text]);
        if (!question) {
          question = { id: randomUUID() };
          await queryInterface.bulkInsert("questions", [{
            id: question.id,
            questionCategoryId: category.id,
            courseId: track.courseId,
            courseTrackId: track.id,
            lessonId: lesson.id,
            topicId: null,
            questionType: "single_choice",
            title: `ප්‍රශ්නය ${index + 1}`,
            questionText: item.text,
            questionTextFormat: "html",
            difficulty: "easy",
            defaultMarks: 1,
            explanation: item.explanation,
            status: "published",
            version: 1,
            createdByUserId: author.id,
            updatedByUserId: author.id,
            publishedAt: now,
            createdAt: now,
            updatedAt: now
          }], { transaction });
          await queryInterface.bulkInsert("question_options", item.options.map((option, optionIndex) => ({
            id: randomUUID(),
            questionId: question.id,
            optionText: option,
            optionTextFormat: "html",
            isCorrect: optionIndex === item.correct,
            sortOrder: optionIndex + 1,
            createdAt: now,
            updatedAt: now
          })), { transaction });
        }
        const linked = await one("SELECT id FROM quiz_questions WHERE quizId = ? AND questionId = ?", [quiz.id, question.id]);
        if (!linked) await queryInterface.bulkInsert("quiz_questions", [{
          id: randomUUID(),
          quizId: quiz.id,
          questionId: question.id,
          marks: 1,
          sortOrder: index + 1,
          isRequired: true,
          createdAt: now,
          updatedAt: now
        }], { transaction });
      }
    });
  },

  async down(queryInterface) {
    const database = queryInterface.sequelize;
    await database.transaction(async (transaction) => {
      const rows = await database.query("SELECT id FROM question_categories WHERE slug = ?", { replacements: ["data-information-mcq"], type: QueryTypes.SELECT, transaction });
      const categoryIds = rows.map((row) => row.id);
      if (categoryIds.length) {
        const questionRows = await database.query("SELECT id FROM questions WHERE questionCategoryId IN (?)", { replacements: [categoryIds], type: QueryTypes.SELECT, transaction });
        const questionIds = questionRows.map((row) => row.id);
        if (questionIds.length) {
          await queryInterface.bulkDelete("quiz_questions", { questionId: questionIds }, { transaction });
          await queryInterface.bulkDelete("question_options", { questionId: questionIds }, { transaction });
          await queryInterface.bulkDelete("questions", { id: questionIds }, { transaction });
        }
        await queryInterface.bulkDelete("question_categories", { id: categoryIds }, { transaction });
      }
      const activityRows = await database.query("SELECT id FROM lesson_sections WHERE type = 'quiz' AND titleSi = ?", { replacements: [quizTitle], type: QueryTypes.SELECT, transaction });
      const activityIds = activityRows.map((row) => row.id);
      if (activityIds.length) {
        await queryInterface.bulkDelete("quizzes", { lessonSectionId: activityIds }, { transaction });
        await queryInterface.bulkDelete("lesson_sections", { id: activityIds }, { transaction });
      }
    });
  }
};
