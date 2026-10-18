import { validateContentPayload } from "../src/modules/content/content-validation.js";

describe("independent lesson landing content", () => {
  it("accepts marketing copy and a separate syllabus", () => {
    expect(() => validateContentPayload({ landingPageContent: { overview: "Public introduction", syllabus: [{ title: "What you will learn", description: "A public summary" }] } }, "lesson")).not.toThrow();
    expect(() => validateContentPayload({ landingPageContent: null }, "lesson")).not.toThrow();
    expect(() => validateContentPayload({ landingPageContent: { syllabus: [] } }, "lesson")).not.toThrow();
  });
  it.each([
    [], "invalid", { overview: 3 }, { topics: [] }, { syllabus: {} },
    { syllabus: [{ title: "" }] }, { syllabus: [{ title: "Heading", topicId: "lms-topic" }] },
    { syllabus: [{ title: "Heading", description: {} }] },
    { syllabus: Array.from({ length: 101 }, () => ({ title: "Heading" })) },
  ])("rejects malformed content and LMS topic links: %j", (landingPageContent) => {
    expect(() => validateContentPayload({ landingPageContent }, "lesson")).toThrow("Invalid landing page content");
  });
});
