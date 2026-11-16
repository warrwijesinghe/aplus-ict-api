import { ApiError } from "../../core/errors.js";

export const escapeQuestionText = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const parseAiken = (text) => {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 256 * 1024)
    throw new ApiError(422, "Upload a UTF-8 text file up to 256 KB.");
  const invalid = (line, message) => { throw new ApiError(422, `Line ${line}: ${message}`); };
  const questions = [];
  let question;
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n?|\n/);
  lines.forEach((value, index) => {
    const line = value.trim();
    const number = index + 1;
    if (!line) return;
    const option = line.match(/^([A-Z])[.)]\s+(.+)$/);
    const answer = line.match(/^ANSWER: ([A-Z])$/);
    if (!question) {
      if (option || /^ANSWER:/i.test(line)) invalid(number, "Enter the question text first.");
      question = { line: number, questionText: escapeQuestionText(line), options: new Map() };
      return;
    }
    if (option) {
      if (question.options.has(option[1])) invalid(number, "This option letter is already used.");
      question.options.set(option[1], escapeQuestionText(option[2]));
      return;
    }
    if (!answer) invalid(number, "Expected an option like A. Choice or an answer like ANSWER: A.");
    if (question.options.size < 2) invalid(number, "Add at least two options.");
    if (!question.options.has(answer[1])) invalid(number, "The correct answer must match an option letter.");
    if (questions.length === 200) invalid(number, "Upload at most 200 questions at a time.");
    questions.push({
      questionText: question.questionText,
      options: [...question.options].map(([letter, optionText], index) => ({
        optionText, isCorrect: letter === answer[1], sortOrder: index + 1,
      })),
    });
    question = null;
  });
  if (question) invalid(question.line, "This question is missing its ANSWER line.");
  if (!questions.length) throw new ApiError(422, "The file contains no questions.");
  return questions;
};
