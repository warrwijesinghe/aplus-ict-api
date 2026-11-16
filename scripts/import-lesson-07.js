import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../src/models/index.js";

const [stage, mode = "--dry-run"] = process.argv.slice(2);
assert(stage && ["--dry-run", "--apply"].includes(mode), "Pass the extracted package directory and optionally --apply");
const read = (file) => JSON.parse(readFileSync(join(stage, file), "utf8"));
const manifest = read("content/manifest.json");
const lesson = read("content/lesson.json");
const placement = read("placement.json");
const indexById = (rows) => {
  const index = new Map(rows.map((row) => [row.id, row]));
  assert.equal(index.size, rows.length, "Duplicate source IDs");
  return index;
};
const slots = indexById(lesson.assessmentSlots);
const sequence = indexById(lesson.sequence);
const videos = new Map(lesson.topics.flatMap((topic) => topic.subtopics.map((video) => [video.id, { topic, video }])));
assert.equal(videos.size, 57);
assert.equal(slots.size, 71);
assert.equal(sequence.size, 128);
assert.equal(placement.length, 71);

const escapeHtml = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>");
const stableId = (...parts) => {
  const hex = createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), "5" + hex.slice(13, 16), "8" + hex.slice(17, 20), hex.slice(20, 32)].join("-");
};
const plans = manifest.languages.map((language) => {
  const file = manifest.quizArchive.languageFiles[language];
  const bank = read(join("bank", file));
  const quizzes = indexById(bank.quizzes);
  assert.equal(bank.medium, language);
  assert.equal(bank.lessonNumber, 7);
  assert.equal(bank.schemaVersion, manifest.quizArchive.schemaVersion);
  assert.equal(quizzes.size, 71);
  let quizOrder = 0;
  let topic;
  const activities = lesson.sequence.map(({ id, type }, order) => {
    if (type === "video") {
      const entry = videos.get(id);
      assert(entry && entry.video.media[language] === null);
      topic = entry.topic;
      return { id, topic, order, video: entry.video };
    }
    assert.equal(type, "assessment");
    const slot = slots.get(id);
    const quiz = quizzes.get(id);
    const csv = placement[quizOrder++];
    const previous = lesson.sequence[order - 1].id;
    assert.deepEqual(slot.bindings[language], { file, quizId: id });
    assert.equal(slot.afterId, previous);
    assert.equal(quiz.displayOrder, quizOrder);
    assert.equal(csv.Order, String(quizOrder));
    assert.equal(csv["Quiz ID"], id);
    assert.equal(csv["Activity type"], quiz.kind);
    assert.equal(quiz.kind, slot.kind);
    assert.equal(quiz.weightPercent, slot.weightPercent);
    assert.equal(Number(csv["Weight percent"]), slot.weightPercent);
    assert.equal(quiz.graded, slot.graded);
    assert.equal(csv.Graded, String(quiz.graded));
    assert.equal(quiz.title, slot.title[language]);
    assert.equal(csv[language === "en" ? "Title (English)" : "Title (Sinhala)"], quiz.title);
    assert.equal(csv.Questions, String(quiz.questions.length));
    assert.equal(quiz.questions.length, slot.questionCountPerMedium);
    const anchor = quiz.placement.afterContent;
    if (anchor) {
      const { topic: parent, video } = videos.get(previous);
      assert.deepEqual(anchor, { topic: parent.code, subtopicOrder: video.order, subtopicTitle: video.title[language] });
    } else {
      assert.equal(quiz.placement.afterQuizId, previous);
    }
    assert.equal(csv[language === "en" ? "After anchor (English)" : "After anchor (Sinhala)"],
      anchor ? [anchor.topic, anchor.subtopicOrder, anchor.subtopicTitle].join(" / ") : previous);
    assert.equal(csv["Before topic"], quiz.placement.beforeTopic || "");
    assert.equal(csv["Before quiz ID"], quiz.placement.beforeQuizId || "");
    const cases = indexById(quiz.cases);
    indexById(quiz.questions);
    let points = 0;
    for (const question of quiz.questions) {
      assert(["dropdown", "mcq", "true_false"].includes(question.type), question.id);
      assert(indexById(question.options).has(question.correctOptionId), question.id);
      assert(!question.caseId || cases.has(question.caseId), question.id);
      assert(question.points > 0, question.id);
      points += question.points;
    }
    assert.equal(points, quiz.totalPoints);
    return { id, topic, order, quiz, slot, cases };
  });
  assert.equal(activities.filter((item) => item.quiz).length, 71);
  assert.equal(bank.quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0), 399);
  assert.deepEqual(bank.quizzes.filter((quiz) => quiz.graded).map((quiz) => quiz.weightPercent), [12, 15, 13, 60]);
  assert.equal(quizzes.get("L07-FINAL").questions.length, 25);
  assert(quizzes.get("L07-FINAL").questions.every((question) => question.points === 1));
  return { language, activities };
});

const now = new Date();
const published = { status: "published", publishedAt: now };
const visible = { status: "published", isVisible: true };
const titles = ({ en, si }, language) => ({ title: language === "en" ? en : si, titleEn: en, titleSi: si });

async function importMedium({ language, activities }, author, transaction) {
  const options = { transaction };
  const track = await db.CourseTrack.findOne({ where: { slug: language === "en" ? "al-ict-english" : "al-ict-sinhala" }, ...options });
  assert(track, "Missing A/L ICT track");
  const lessons = await db.Lesson.findAll({ where: { trackId: track.id, lessonNumber: 7 }, ...options, lock: true });
  assert.equal(lessons.length, 1, "Expected one Lesson 07 per track");
  const [target] = lessons;
  const uuid = (...parts) => stableId(manifest.packageId, target.id, language, ...parts);
  const common = { lessonId: target.id, courseId: track.courseId, courseTrackId: track.id };
  const owner = { createdByUserId: author.id };
  const counts = {};
  const existing = new Map();
  const pending = new Map();
  const existingTopics = await db.Topic.findAll({ where: { lessonId: target.id }, ...options });
  const existingSections = await db.LessonSection.findAll({ where: { lessonId: target.id }, ...options });
  const existingQuizzes = await db.Quiz.findAll({ where: { lessonId: target.id }, ...options });
  const existingQuestions = await db.Question.findAll({ where: { lessonId: target.id }, ...options });
  for (const [model, rows] of [
    [db.Topic, existingTopics], [db.LessonSection, existingSections], [db.Quiz, existingQuizzes], [db.Question, existingQuestions],
    [db.QuestionCategory, await db.QuestionCategory.findAll({ where: { lessonId: target.id }, ...options })],
    [db.QuestionOption, await db.QuestionOption.findAll({ where: { questionId: existingQuestions.map(({ id }) => id) }, ...options })],
    [db.QuizQuestion, await db.QuizQuestion.findAll({ where: { quizId: existingQuizzes.map(({ id }) => id) }, ...options })],
  ]) {
    existing.set(model, indexById(rows));
    pending.set(model, []);
  }
  function ensure(model, id, values, scope = {}) {
    const count = counts[model.name] ??= { created: 0, matched: 0 };
    const record = existing.get(model).get(id);
    if (record) {
      for (const [key, value] of Object.entries(scope)) assert.equal(record[key], value, `Existing identity conflict for ${model.name} ${id}`);
      count.matched++;
      return record;
    }
    count.created++;
    const created = { id, ...values };
    pending.get(model).push(created);
    return created;
  }

  const topicIds = new Map();
  for (const topic of lesson.topics) {
    const slug = topic.id.toLowerCase();
    const id = uuid(topic.id);
    const matches = existingTopics.filter((row) => row.id === id || row.slug === slug || row.slug === topic.code ||
      [row.title, language === "en" ? row.titleEn : row.titleSi].includes(topic.title[language]));
    assert(matches.length <= 1, `Ambiguous topic ${language} ${topic.code}`);
    const record = ensure(db.Topic, matches[0]?.id || id, {
      lessonId: target.id, slug, ...titles(topic.title, language), ...visible, sortOrder: topic.order,
    }, { lessonId: target.id });
    topicIds.set(topic.id, record.id);
  }

  const categorySlug = "l07-import";
  const category = ensure(db.QuestionCategory, uuid(categorySlug), {
    ...common, ...owner, name: lesson.title[language], slug: categorySlug, status: "published",
  }, { lessonId: target.id, courseTrackId: track.id });
  const expectedQuizIds = [];
  for (const { id, topic, order, quiz, video, slot, cases } of activities) {
    const topicId = topicIds.get(topic.id);
    const localized = (video || slot).title;
    const matches = existingSections.filter((row) => row.config?.lessonImport?.id === id ||
      (row.topicId === topicId && (row.title === localized[language] || row[language === "en" ? "titleEn" : "titleSi"] === localized[language])));
    assert(matches.length <= 1, `Ambiguous section ${language} ${id}`);
    const sectionId = matches[0]?.id || uuid("section", id);
    const type = video ? "video" : "quiz";
    const metadata = { id, packageId: manifest.packageId, language, ...(video ? { videoBriefEn: video.videoBriefEn } : {
      kind: quiz.kind, weightPercent: quiz.weightPercent, cases: quiz.cases,
      questions: quiz.questions.map((question) => ({
        id: question.id, lmsId: uuid(id, question.id), type: question.type, caseId: question.caseId,
        syllabus: question.syllabus, source: question.source,
        options: question.options.map((option) => ({ id: option.id, lmsId: uuid(id, question.id, option.id) })),
      })),
    }) };
    const section = ensure(db.LessonSection, sectionId, {
      lessonId: target.id, topicId, type, ...titles(localized, language), accessPolicy: video ? "premium" : "free", sortOrder: order + 1,
      config: { lessonImport: metadata }, ...(video ? { status: "draft", isVisible: false, completionMode: "manual" } :
        { ...visible, publishedAt: now, completionMode: "submit", maxScore: quiz.totalPoints }),
    }, { lessonId: target.id, type });
    if (video) continue;
    const quizId = uuid("quiz", id);
    const attached = existingQuizzes.find((row) => row.lessonSectionId === section.id);
    assert(!attached || attached.id === quizId, `Unmapped existing assessment ${language} ${id} (${attached?.id})`);
    assert.equal(section.config?.lessonImport?.id, id, `Missing source mapping for ${language} ${id}`);
    expectedQuizIds.push(quizId);
    ensure(db.Quiz, quizId, {
      ...common, ...owner, ...published, topicId, lessonSectionId: section.id, title: quiz.title,
      showCorrectAnswers: !quiz.graded, showExplanations: !quiz.graded,
    }, { lessonSectionId: section.id, lessonId: target.id });
    const links = [...existing.get(db.QuizQuestion).values()].filter((row) => row.quizId === quizId);
    const expectedLinks = new Set();
    for (const [i, question] of quiz.questions.entries()) {
      const questionId = uuid(id, question.id);
      const caseText = cases.get(question.caseId)?.text;
      ensure(db.Question, questionId, {
        ...common, ...owner, ...published, topicId, questionCategoryId: category.id, title: question.id,
        questionType: question.type === "true_false" ? "true_false" : "single_choice",
        questionTextFormat: question.type === "dropdown" ? "dropdown" : "html",
        questionText: caseText ? `<p>${escapeHtml(caseText)}</p><p>${escapeHtml(question.prompt)}</p>` : escapeHtml(question.prompt),
        defaultMarks: question.points, correctFeedback: question.feedback, explanation: question.feedback,
      }, { lessonId: target.id, title: question.id });
      for (const [j, option] of question.options.entries()) {
        ensure(db.QuestionOption, uuid(id, question.id, option.id), {
          questionId, optionText: escapeHtml(option.text), matchKey: option.id,
          isCorrect: option.id === question.correctOptionId, sortOrder: j + 1,
        }, { questionId, matchKey: option.id });
      }
      const linkId = uuid("link", id, question.id);
      expectedLinks.add(linkId);
      ensure(db.QuizQuestion, linkId, { quizId, questionId, marks: question.points, sortOrder: i + 1 }, { quizId, questionId });
    }
    assert(links.every((link) => expectedLinks.has(link.id)), `Unexpected question links in ${quiz.id}`);
  }

  for (const model of [db.Topic, db.QuestionCategory, db.LessonSection, db.Quiz, db.Question, db.QuestionOption, db.QuizQuestion]) {
    const rows = pending.get(model);
    for (let start = 0; start < rows.length; start += 250) {
      await model.bulkCreate(rows.slice(start, start + 250), options);
    }
  }
  const persistedQuizzes = await db.Quiz.findAll({ where: { id: expectedQuizIds }, include: [{ model: db.LessonSection, as: "Activity" }], ...options });
  const persistedQuestions = await db.QuizQuestion.count({ where: { quizId: expectedQuizIds }, ...options });
  const weight = persistedQuizzes.reduce((sum, quiz) => sum + quiz.Activity.config.lessonImport.weightPercent, 0);
  const drafts = await db.LessonSection.count({ where: { lessonId: target.id, type: "video", status: "draft", isVisible: false }, ...options });
  assert.equal(persistedQuizzes.length, 71);
  assert.equal(persistedQuestions, 399);
  assert.equal(weight, 100);
  console.log(JSON.stringify({ language, quizzes: persistedQuizzes.length, questions: persistedQuestions, weight, draftVideos: drafts, counts }));
}

const transaction = await db.sequelize.transaction();
try {
  const author = await db.User.findOne({
    where: { role: ["super_admin", "admin", "content_editor", "teacher"], status: "active" },
    order: [["createdAt", "ASC"]], transaction,
  });
  assert(author, "An active staff author is required");
  for (const plan of plans) await importMedium(plan, author, transaction);
  if (mode === "--apply") await transaction.commit();
  else await transaction.rollback();
  console.log(mode === "--apply" ? "Committed both languages" : "Dry run rolled back");
} catch (error) {
  if (!transaction.finished) await transaction.rollback();
  throw error;
} finally {
  await db.sequelize.close();
}
