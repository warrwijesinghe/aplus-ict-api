/** Progress counts the full required curriculum, independently of access locks. */
export const accessibleProgress = (contentItems, { hasFullAccess = false } = {}) => {
  const required = contentItems.filter((item) => item.completionMode !== 'none' && item.isRequired !== false);
  const done = (item) => item.progress?.status === 'completed';
  const completedActivities = required.filter(done).length;
  const totalRequiredActivities = required.length;
  const free = required.filter((item) => !['premium', 'paid'].includes(item.accessPolicy));
  const freeCompletedActivities = free.filter(done).length;
  const allDone = totalRequiredActivities > 0 && completedActivities === totalRequiredActivities;
  const progressPercent = totalRequiredActivities ? allDone ? 100 : Math.min(99, Math.round(completedActivities / totalRequiredActivities * 100)) : 0;
  const isCompleted = Boolean(hasFullAccess && allDone);
  return { completedActivities, totalRequiredActivities,
    // Compatibility alias: this now means all required activities, never just unlocked ones.
    totalAccessibleActivities: totalRequiredActivities, progressPercent,
    completedCount: completedActivities, requiredCount: totalRequiredActivities, percentage: progressPercent,
    freeRequiredActivities: free.length, freeCompletedActivities,
    freePreviewCompleted: free.length > 0 && freeCompletedActivities === free.length,
    isCompleted, status: isCompleted ? 'completed' : completedActivities ? 'in_progress' : 'not_started' };
};