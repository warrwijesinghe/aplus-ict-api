import { parseAiken } from "../src/modules/quiz/aiken.js";

describe("Aiken quiz import", () => {
  it("preserves question and answer order, Unicode, and literal markup", () => {
    const questions = parseAiken("\uFEFFWhat is 2 < 3?\r\nA. True\r\nB. False\r\nANSWER: A\r\n\r\nසිංහල\r\nA) HTML & CSS\r\nB) Python\r\nANSWER: B");
    expect(questions).toHaveLength(2);
    expect(questions[0].questionText).toBe("What is 2 &lt; 3?");
    expect(questions[1]).toEqual({
      questionText: "සිංහල",
      options: [
        { optionText: "HTML &amp; CSS", isCorrect: false, sortOrder: 1 },
        { optionText: "Python", isCorrect: true, sortOrder: 2 },
      ],
    });
  });

  it.each([
    ["Question\nA. First\nA. Second\nANSWER: A", "Line 3"],
    ["Question\nA. First\nB. Second\nANSWER: C", "Line 4"],
    ["Question\nA. First\nANSWER: A", "at least two options"],
    ["Question\nA. First\nB. Second", "missing its ANSWER line"],
    ["", "contains no questions"],
  ])("rejects an invalid file", (file, message) => expect(() => parseAiken(file)).toThrow(message));
});
