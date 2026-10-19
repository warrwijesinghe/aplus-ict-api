import { accessibleProgress } from '../src/modules/learning/progress.service.js';
import { jest } from '@jest/globals';
import { db } from '../src/models/index.js';
import { progressForCourse } from '../src/modules/learning/completion-gradebook.service.js';

const lesson = (freeDone = 3, paidDone = 0) => Array.from({ length: 20 }, (_, index) => ({ completionMode: index === 19 ? 'pass' : 'manual', accessPolicy: index < 3 ? 'free' : 'premium', isLocked: index >= 3, progress: { status: index < freeDone || (index >= 3 && index < 3 + paidDone) ? 'completed' : 'not_started' } }));

test('3 completed preview activities out of 20 required activities is 15%, never completed', () => {
  expect(accessibleProgress(lesson())).toMatchObject({ completedActivities: 3, totalRequiredActivities: 20, progressPercent: 15, freePreviewCompleted: true, isCompleted: false, status: 'in_progress' });
});

test('purchasing unlocks activities without changing the denominator or resetting earned progress', () => {
  const preview = accessibleProgress(lesson());
  const paid = accessibleProgress(lesson().map((item) => ({ ...item, isLocked: false })), { hasFullAccess: true });
  expect(paid.completedActivities).toBe(preview.completedActivities);
  expect(paid.totalRequiredActivities).toBe(preview.totalRequiredActivities);
  expect(paid.progressPercent).toBe(15);
  expect(paid.isCompleted).toBe(false);
});

test('completion requires both full access and every required activity, including quizzes', () => {
  const allDone = lesson(3, 17);
  expect(accessibleProgress(allDone).isCompleted).toBe(false);
  expect(accessibleProgress(allDone, { hasFullAccess: true })).toMatchObject({ isCompleted: true, progressPercent: 100, status: 'completed' });
  expect(accessibleProgress(lesson(3, 16), { hasFullAccess: true })).toMatchObject({ isCompleted: false, progressPercent: 95 });
});

test('labels and optional activities do not count; submit/pass requirements do', () => {
  expect(accessibleProgress([
    { completionMode: 'none', progress: { status: 'completed' } },
    { completionMode: 'manual', isRequired: false, progress: { status: 'completed' } },
    { completionMode: 'submit', progress: { status: 'not_started' } },
    { completionMode: 'pass', progress: { status: 'not_started' } },
    { completionMode: 'manual', progress: { status: 'completed' } },
  ])).toMatchObject({ completedActivities: 1, totalRequiredActivities: 3, progressPercent: 33 });
});

test('rounding cannot display 100% for an incomplete curriculum', () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ completionMode: 'manual', progress: { status: index === 999 ? 'not_started' : 'completed' } }));
  expect(accessibleProgress(rows, { hasFullAccess: true })).toMatchObject({ progressPercent: 99, isCompleted: false });
});

test('course/lesson gradebook progress uses all required rows while the student still has free-only access', async () => {
  try {
    jest.spyOn(db.Lesson, 'findAll').mockResolvedValue([{ id: 'lesson' }]);
    jest.spyOn(db.Topic, 'findAll').mockResolvedValue([]);
    jest.spyOn(db.LessonSection, 'findAll').mockResolvedValue(lesson().map((item, index) => ({ ...item, id: String(index), lessonId: 'lesson' })));
    jest.spyOn(db.Entitlement, 'findAll').mockResolvedValue([]);
    jest.spyOn(db.ActivityCompletion, 'findAll').mockResolvedValue([0, 1, 2].map((index) => ({ activityId: String(index), status: 'completed' })));
    const result = await progressForCourse('user', 'track');
    expect(result.lessons[0]).toMatchObject({ requiredCount: 20, completedCount: 3, percentage: 15, isCompleted: false, freePreviewCompleted: true });
    expect(result.course.percentage).toBe(15);
  } finally { jest.restoreAllMocks(); }
});
