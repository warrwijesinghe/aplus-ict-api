import { ApiError } from "../src/core/errors.js";
import request from "supertest";
import { app } from "../src/app.js";
import { ACTIVITY_TYPES, ACCESS_POLICIES, COMPLETION_MODES } from "../src/modules/content/activity-registry.js";
import { safeActivity } from "../src/modules/content/content.service.js";
import { validateContentPayload, validateAvailability, validateSlug } from "../src/modules/content/content-validation.js";
import { validateActivityResource } from "../src/modules/content/activities/activity-validator.js";

const activity = {
  id: "activity-1", title: "Premium video", titleEn: "Premium video", titleSi: null,
  descriptionEn: "Practice", descriptionSi: null, type: "video", accessPolicy: "premium",
  completionMode: "pass", estimatedMinutes: 12, sortOrder: 2, content: "secret body",
  youtubeUrl: "https://youtu.be/private", externalUrl: "https://example.com/private",
  resourceId: "resource-1", config: { private: true }, instructions: "secret instructions",
  maxScore: 10, passingScore: 8,
};

describe("LMS content architecture", () => {
  it("has a central registry for controlled learning activity fields", () => {
    expect(ACTIVITY_TYPES).toEqual(expect.arrayContaining(["label", "page", "video", "assignment", "quiz"]));
    expect(ACCESS_POLICIES).toEqual(["free", "premium"]);
    expect(COMPLETION_MODES).toEqual(["none", "view", "manual", "submit", "pass"]);
  });

  it("rejects invalid content input", () => {
    expect(() => validateContentPayload({ type: "unknown" }, "activity")).toThrow(ApiError);
    expect(() => validateContentPayload({ completionMode: "later" }, "activity")).toThrow("Invalid completionMode");
    expect(() => validateContentPayload({ accessPolicy: "paid" }, "activity")).toThrow("Invalid accessPolicy");
    expect(() => validateAvailability({ availableFrom: "2026-08-06", availableUntil: "2026-08-05" })).toThrow("availableUntil");
    expect(() => validateContentPayload({ maxScore: 5, passingScore: 6 }, "activity")).toThrow("passingScore");
    expect(() => validateContentPayload({ youtubeUrl: "https://vimeo.com/1" }, "activity")).toThrow("approved YouTube");
    expect(() => validateContentPayload({ externalUrl: "javascript:alert(1)" }, "activity")).toThrow("Invalid externalUrl");
    expect(() => validateSlug("Invalid Slug")).toThrow("Invalid slug");
  });

  it("redacts every protected premium delivery field for an unentitled request", () => {
    const response = safeActivity(activity, false);
    expect(response).toMatchObject({ id: "activity-1", type: "video", accessPolicy: "premium", completionMode: "pass", isLocked: true });
    for (const field of ["content", "youtubeUrl", "externalUrl", "resourceId", "config", "instructions", "maxScore", "passingScore"]) expect(response).not.toHaveProperty(field);
    expect(safeActivity(activity, true)).toMatchObject({ isLocked: false, content: "secret body", resourceId: "resource-1" });
  });

  it("does not expose content-management routes to anonymous users", async () => {
    const response = await request(app).get("/api/v1/admin/activities");
    expect(response.status).toBe(401);
  });

  it("keeps the authorized builder context private and accepts Task 05 resource categories", async () => {
    expect((await request(app).get("/api/v1/admin/content-builder/context")).status).toBe(401);
    expect((await request(app).post("/api/v1/admin/content-builder/courses").send({})).status).toBe(401);
    expect((await request(app).post("/api/v1/admin/content-builder/media").send({})).status).toBe(401);
    expect(() => validateActivityResource({ type: "image" }, { category: "lesson_image", mimeType: "image/webp" })).not.toThrow();
    expect(() => validateActivityResource({ type: "pdf" }, { category: "lesson_pdf", mimeType: "application/pdf" })).not.toThrow();
    expect(() => validateActivityResource({ type: "image" }, { category: "lesson_pdf", mimeType: "application/pdf" })).toThrow("compatible Resource");
  });
});
