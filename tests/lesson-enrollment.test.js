import { jest } from '@jest/globals';
import { db } from '../src/models/index.js';
import { enrollLesson, hasLessonEnrollment, lessonEnrollmentActive, myLessonEnrollments } from '../src/modules/students/lesson-enrollment.service.js';
import { canAccessContent } from '../src/modules/learning/access.service.js';
import { purchasedLessonExpiry } from '../src/modules/commerce/lesson-access-policy.js';
import { grantOrderEntitlements } from '../src/modules/commerce/commerce.service.js';

afterEach(() => jest.restoreAllMocks());

test('free membership never expires, even if it has a legacy expiry value', () => {
  const row = { status: 'active', enrolledAt: '2022-01-01', expiresAt: '2024-01-01' };
  expect(lessonEnrollmentActive(row, new Date('2040-01-01'))).toBe(true);
  expect(lessonEnrollmentActive({ ...row, status: 'revoked' })).toBe(false);
  expect(purchasedLessonExpiry('2024-02-29T10:00:00Z').toISOString()).toBe('2026-02-28T10:00:00.000Z');
});

test('repeat free enrollment preserves original membership and needs no end date', async () => {
  jest.spyOn(db.Lesson, 'findOne').mockResolvedValue({ id: 'lesson' });
  const row = { id: 'enrolment', status: 'active', enrolledAt: '2022-01-01', expiresAt: null };
  const find = jest.spyOn(db.LessonEnrolment, 'findOrCreate').mockResolvedValue([row, false]);
  expect(await enrollLesson('user', 'track', 'lesson-slug')).toBe(row);
  expect(find.mock.calls[0][0].defaults.expiresAt).toBeNull();
});

test('missing or revoked membership does not authorize learning', async () => {
  const find = jest.spyOn(db.LessonEnrolment, 'findOne').mockResolvedValue(null);
  expect(await hasLessonEnrollment('user', 'lesson')).toBe(false);
  find.mockResolvedValue({ status: 'revoked', enrolledAt: '2022-01-01' });
  expect(await canAccessContent('user', { id: 'lesson' }, { accessPolicy: 'free' })).toBe(false);
});

test('expired paid access still permits free activities but blocks premium activities', async () => {
  jest.spyOn(db.LessonEnrolment, 'findOne').mockResolvedValue({ status: 'active', enrolledAt: '2022-01-01', expiresAt: null });
  jest.spyOn(db.Entitlement, 'findAll').mockResolvedValue([{ status: 'active', startsAt: '2022-01-01', endsAt: '2024-01-01' }]);
  expect(await canAccessContent('user', { id: 'lesson' }, { accessPolicy: 'free' })).toBe(true);
  expect(await canAccessContent('user', { id: 'lesson' }, { accessPolicy: 'premium' })).toBe(false);
});

const member = { id: 'enrolment', courseTrackId: 'track', lessonId: 'lesson', enrolledAt: '2022-01-01', expiresAt: null, status: 'active', Lesson: { title: 'Computers', slug: 'computers', status: 'published' }, CourseTrack: { slug: 'grade-6', status: 'published', isPublic: true, availabilityStatus: 'active', Course: { title: 'Grade 6 ICT', status: 'published', isPublic: true }, Medium: { nameEn: 'English' } } };

test('free-only lesson cards have no expiry; paid dates come only from the existing entitlement', async () => {
  jest.spyOn(db.LessonEnrolment, 'findAll').mockResolvedValue([member]);
  const grants = jest.spyOn(db.Entitlement, 'findAll').mockResolvedValue([]);
  expect(await myLessonEnrollments('user')).toEqual([expect.objectContaining({ expiresAt: null, purchasedAt: null, accessUntil: null, fullAccess: false, canLearn: true })]);
  grants.mockResolvedValue([{ lessonId: 'lesson', courseTrackId: 'track', sourceType: 'order', status: 'active', startsAt: '2026-01-01', endsAt: '2028-01-01' }]);
  expect(await myLessonEnrollments('user')).toEqual([expect.objectContaining({ purchasedAt: '2026-01-01', accessUntil: '2028-01-01', fullAccess: true, canLearn: true })]);
  grants.mockResolvedValue([{ lessonId: 'lesson', sourceType: 'order', status: 'expired', startsAt: '2022-10-19', endsAt: '2024-10-19' }]);
  expect(await myLessonEnrollments('user')).toEqual([expect.objectContaining({ purchasedAt: '2022-10-19', accessUntil: '2024-10-19', fullAccess: false, purchasedAccessExpired: true, canLearn: true })]);
});

test('successful purchase grants exactly two calendar years from payment, and duplicate callbacks do not extend it', async () => {
  jest.spyOn(db.OrderItem, 'findAll').mockResolvedValue([{ productId: 'product' }]);
  jest.spyOn(db.ProductEntitlementRule, 'findAll').mockResolvedValue([{ lessonId: 'lesson', courseTrackId: 'track', entitlementType: 'lesson_premium_access', durationDays: 30 }]);
  const find = jest.spyOn(db.Entitlement, 'findOne').mockResolvedValue(null);
  const create = jest.spyOn(db.Entitlement, 'create').mockImplementation(async (values) => values);
  const order = { id: 'order', userId: 'user', paymentStatus: 'verified', completedAt: '2026-10-19T09:00:00Z', createdAt: '2026-10-01' };
  const [grant] = await grantOrderEntitlements(order, null);
  expect(grant.startsAt.toISOString()).toBe('2026-10-19T09:00:00.000Z');
  expect(grant.endsAt.toISOString()).toBe('2028-10-19T09:00:00.000Z');
  find.mockResolvedValue(grant);
  expect(await grantOrderEntitlements(order, null)).toEqual([grant]);
  expect(create).toHaveBeenCalledTimes(1);
  await expect(grantOrderEntitlements({ ...order, paymentStatus: 'unpaid' }, null)).rejects.toMatchObject({ status: 409 });
});
