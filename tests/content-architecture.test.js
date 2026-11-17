import { ApiError } from "../src/core/errors.js";
import request from "supertest";
import { jest } from "@jest/globals";
import { Op } from "sequelize";
import { db } from "../src/models/index.js";
import { app } from "../src/app.js";
import { ACTIVITY_TYPES, ACCESS_POLICIES, COMPLETION_MODES, TRACK_AVAILABILITY } from "../src/modules/content/activity-registry.js";
import { deleteTopic, safeActivity } from "../src/modules/content/content.service.js";
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
    expect(TRACK_AVAILABILITY).toEqual(["active", "inactive"]);
  });

  it("rejects invalid content input", () => {
    expect(() => validateContentPayload({ type: "unknown" }, "activity")).toThrow(ApiError);
    expect(() => validateContentPayload({ completionMode: "later" }, "activity")).toThrow("Invalid completionMode");
    expect(() => validateContentPayload({ accessPolicy: "paid" }, "activity")).toThrow("Invalid accessPolicy");
    expect(() => validateContentPayload({ availabilityStatus: "coming_soon" }, "track")).toThrow("Invalid availabilityStatus");
    expect(() => validateContentPayload({ availabilityStatus: "inactive" }, "track")).not.toThrow();
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
    expect((await request(app).get("/api/v1/admin/activities")).status).toBe(401);
    expect((await request(app).delete("/api/v1/admin/topics/topic-1")).status).toBe(401);
    expect((await request(app).delete("/api/v1/admin/activities/activity-1")).status).toBe(401);
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

describe("Permanent topic deletion", () => {
  const topics = [
    { id: "root", title: "1 Foundations", status: "draft" },
    { id: "child", title: "1.1 Data", status: "archived" },
    { id: "grandchild", title: "1.1.1 Collection", status: "draft" },
    { id: "other", title: "10 Other", status: "draft" },
    { id: "other-child", title: "10.1 Other child", status: "draft" },
  ];
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  const mockDeletion = () => {
    jest.spyOn(db.sequelize, "transaction").mockImplementation((run) => run(transaction));
    jest.spyOn(db.Topic, "findByPk").mockResolvedValue({ lessonId: "lesson-1" });
    jest.spyOn(db.Topic, "findAll").mockResolvedValue(topics);
    jest.spyOn(db.Topic, "destroy").mockResolvedValue(3);
    for (const Model of [db.LessonSection, db.Quiz, db.Question, db.ActivityPrerequisite,
      db.ActivityCompletion, db.StudentCourseState, db.StudentLearningHistory]) {
      jest.spyOn(Model, "findOne").mockResolvedValue(null);
    }
  };

  afterEach(() => jest.restoreAllMocks());

  it("deletes the selected branch, including archived and deeply nested subtopics", async () => {
    mockDeletion();
    await expect(deleteTopic("root")).resolves.toBe(3);
    expect(db.Topic.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { lessonId: "lesson-1" }, transaction, lock: "UPDATE" }));
    expect(db.Topic.destroy).toHaveBeenCalledWith({ where: { id: { [Op.in]: ["root", "child", "grandchild"] } }, transaction });
  });

  it("leaves the entire branch intact when a descendant has a linked activity", async () => {
    mockDeletion();
    db.LessonSection.findOne.mockImplementation(async ({ where }) => where.topicId[Op.in].includes("grandchild") ? { id: "activity" } : null);
    await expect(deleteTopic("root")).rejects.toThrow("linked activities");
    expect(db.Topic.destroy).not.toHaveBeenCalled();
  });
});
