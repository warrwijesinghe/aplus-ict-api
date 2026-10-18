import { jest } from "@jest/globals";
import { db } from "../src/models/index.js";
import { dashboard } from "../src/modules/students/student-learning.service.js";

afterEach(() => jest.restoreAllMocks());

it("keeps the dashboard available when an enrolled course becomes unavailable", async () => {
  jest.spyOn(db.Enrolment, "findAll").mockResolvedValue([{
    id: "enrolment", source: "free", status: "active", CourseTrack: {
      id: "track", slug: "course", title: "ICT course", status: "published", isPublic: true,
      availabilityStatus: "inactive", Course: { status: "published", isPublic: true, courseGroup: "SCHOOL" }, Medium: { code: "english" },
    },
  }]);
  jest.spyOn(db.StudentCourseState, "findOne").mockResolvedValue(null);
  jest.spyOn(db.StudentLearningHistory, "findAndCountAll").mockResolvedValue({ rows: [], count: 0 });
  const result = await dashboard("student");
  expect(result.courses).toEqual([expect.objectContaining({ courseTrackId: "track", availabilityStatus: "unavailable", continueLearning: null, progress: null })]);
  expect(result.continueLearning).toBeNull();
});
