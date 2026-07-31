import { accessibleProgress } from "../src/modules/learning/progress.service.js";

describe("accessibleProgress", () => {
  it("counts only free content until premium content is unlocked", () => {
    const freeContent = Array.from({ length: 10 }, (_, index) => ({
      isLocked: false,
      progress: { status: index < 4 ? "completed" : "not_started" },
    }));
    const paidContent = Array.from({ length: 10 }, () => ({
      isLocked: true,
      progress: { status: "not_started" },
    }));

    expect(accessibleProgress([...freeContent, ...paidContent])).toEqual({
      completedActivities: 4,
      totalAccessibleActivities: 10,
      progressPercent: 40,
    });
  });

  it("expands the denominator after the premium lesson unlock", () => {
    const content = Array.from({ length: 20 }, (_, index) => ({
      isLocked: false,
      progress: { status: index < 4 ? "completed" : "not_started" },
    }));

    expect(accessibleProgress(content)).toEqual({
      completedActivities: 4,
      totalAccessibleActivities: 20,
      progressPercent: 20,
    });
  });
});
