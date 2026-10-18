import { jest } from "@jest/globals";
import request from "supertest";
import { app } from "../src/app.js";
import { db } from "../src/models/index.js";
import { Op } from "sequelize";

describe("public course selection", () => {
  afterEach(() => jest.restoreAllMocks());
  it("lists published active and inactive track summaries without lesson content", async () => {
    const find = jest.spyOn(db.CourseTrack, "findAll").mockResolvedValue([
      { id: "active", slug: "active", title: "Track", availabilityStatus: "active", Course: { title: "Course", courseGroup: "SCHOOL" }, Medium: { name: "Sinhala" }, Lessons: [{ content: "private" }] },
      { id: "soon", slug: "soon", title: "Track", availabilityStatus: "inactive", Course: { title: "Future", courseGroup: "DEGREE" }, Medium: { name: "English" } },
      { id: "short", slug: "short", title: "Track", availabilityStatus: "inactive", Course: { title: "Short course", courseGroup: "SHORT_COURSES" }, Medium: { name: "English" } },
    ]);
    const response = await request(app).get("/api/v1/public/course-selection");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      { id: "active", slug: "active", title: "Course", courseGroup: "SCHOOL", medium: "Sinhala", availabilityStatus: "active" },
      { id: "soon", slug: "soon", title: "Future", courseGroup: "DEGREE", medium: "English", availabilityStatus: "inactive" },
      { id: "short", slug: "short", title: "Short course", courseGroup: "SHORT_COURSES", medium: "English", availabilityStatus: "inactive" },
    ]);
    const options = find.mock.calls[0][0];
    expect(options.where).toEqual({ status: "published", isPublic: true });
    expect(options.include[0].where).toMatchObject({ status: "published", isPublic: true });
    expect(options.include[0].where.courseGroup[Op.in]).toContain("SHORT_COURSES");
  });
});
