import { ApiError } from "../src/core/errors.js";
import { ACTIVITY_TYPES, activityTypeMetadata, getActivityType } from "../src/modules/content/activities/activity-types.js";
import { sanitizeEducationalHtml } from "../src/modules/content/activities/html-sanitizer.js";
import { normalizeYouTubeUrl, validateActivityDraft, validateActivityForPublishing } from "../src/modules/content/activities/activity-validator.js";
import { serializeActivity } from "../src/modules/content/activities/activity-serializer.js";

describe("Learning Activity type registry", () => {
  it("registers every supported activity exactly once and exposes safe form metadata", () => {
    expect(ACTIVITY_TYPES).toEqual(expect.arrayContaining(["label", "page", "rich_text", "video", "image", "pdf", "file", "download", "external_link", "embed", "practical_activity", "assignment", "quiz"]));
    expect(new Set(ACTIVITY_TYPES).size).toBe(ACTIVITY_TYPES.length);
    const video = activityTypeMetadata().find((item) => item.code === "video");
    expect(video).toMatchObject({ name: "Video", supportedCompletionModes: ["none", "view", "manual"], status: "active" });
    expect(video).not.toHaveProperty("implementationPath");
    expect(() => getActivityType("unknown")).toThrow(ApiError);
  });
});

describe("Learning Activity validation", () => {
  it("sanitizes educational formatting and removes executable markup", () => {
    expect(sanitizeEducationalHtml('<p onclick="alert(1)"><strong>Safe</strong></p><script>alert(1)</script>')).toBe("<p><strong>Safe</strong></p>");
    expect(() => sanitizeEducationalHtml('<a href="javascript:alert(1)">bad</a>')).toThrow("Unsafe URL");
  });

  it("normalizes approved YouTube links and rejects other providers", () => {
    expect(normalizeYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(normalizeYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(() => normalizeYouTubeUrl("https://vimeo.com/123")).toThrow("approved YouTube");
  });

  it("enforces per-type completion modes, safe URLs, and strict config keys", () => {
    expect(() => validateActivityDraft({ type: "label", completionMode: "manual" })).toThrow("not supported");
    expect(() => validateActivityDraft({ type: "page", accessPolicy: "paid" })).toThrow("Invalid accessPolicy");
    expect(() => validateActivityDraft({ type: "external_link", externalUrl: "data:text/plain,unsafe" })).toThrow("Invalid externalUrl");
    expect(() => validateActivityDraft({ type: "video", config: { accessToken: "secret" } })).toThrow("Unsupported config key");
    expect(() => validateActivityDraft({ type: "page", availableFrom: "2026-08-06", availableUntil: "2026-08-05" })).toThrow("cannot be earlier");
    expect(() => validateActivityDraft({ type: "quiz", maxScore: 5, passingScore: 6 })).toThrow("cannot exceed");
    expect(validateActivityDraft({ type: "practical_activity", config: { requiredSoftware: ["LibreOffice Calc"], expectedOutput: "Spreadsheet" } }).config.requiredSoftware).toEqual(["LibreOffice Calc"]);
  });

  it("keeps assignment and quiz draft-only until their normalized engines exist", () => {
    expect(() => validateActivityForPublishing({ type: "assignment", title: "Upload work" })).toThrow("setup is incomplete");
    expect(() => validateActivityForPublishing({ type: "quiz", title: "Network quiz" })).toThrow("must be linked");
    expect(() => validateActivityForPublishing({ type: "page", title: "Notes", content: "" })).toThrow("requires non-empty content");
  });
});

describe("Learning Activity student serialization", () => {
  const premiumVideo = {
    id: "activity-1", type: "video", title: "Premium video", titleEn: "Premium video", accessPolicy: "premium", completionMode: "view", estimatedMinutes: 10, sortOrder: 1,
    content: "<p>secret</p>", youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", resourceId: "resource-1", config: { provider: "youtube" }, instructions: "secret instructions",
  };
  it("redacts locked premium details while returning authorized student content", () => {
    expect(serializeActivity(premiumVideo, "public")).toMatchObject({ id: "activity-1", isLocked: true, type: "video" });
    expect(serializeActivity(premiumVideo, "public")).not.toHaveProperty("youtubeUrl");
    expect(serializeActivity(premiumVideo, "authorized_student")).toMatchObject({ isLocked: false, youtubeUrl: premiumVideo.youtubeUrl, resourceId: "resource-1" });
  });
  it("prefers the current authored title over a legacy English fallback", () => {
    expect(serializeActivity({ ...premiumVideo, title: "දත්ත සහ තොරතුරු", titleEn: "Legacy page title" }, "admin")).toMatchObject({ title: "දත්ත සහ තොරතුරු", titleEn: "Legacy page title" });
  });
});
