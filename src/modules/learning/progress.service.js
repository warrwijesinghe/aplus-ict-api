/**
 * Progress uses only content a student can currently access. This lets free
 * learners feel progress immediately, while an unlock intentionally expands
 * the denominator to include the newly available premium content.
 */
export const accessibleProgress = (contentItems) => {
  // Labels and future submit/pass activities cannot be completed by this
  // player, so they never dilute a learner's current progress percentage.
  const accessibleItems = contentItems.filter((item) => !item.isLocked && !["none", "submit", "pass"].includes(item.completionMode));
  const completedItems = accessibleItems.filter(
    (item) => item.progress?.status === "completed",
  );
  const totalAccessibleActivities = accessibleItems.length;
  const completedActivities = completedItems.length;

  return {
    completedActivities,
    totalAccessibleActivities,
    progressPercent: totalAccessibleActivities
      ? Math.round((completedActivities / totalAccessibleActivities) * 100)
      : 0,
  };
};
