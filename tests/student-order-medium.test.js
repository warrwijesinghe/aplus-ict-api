import { jest } from '@jest/globals';
import { db } from '../src/models/index.js';
import { listStudentOrders, serializeOrder } from '../src/modules/commerce/commerce.service.js';

afterEach(() => jest.restoreAllMocks());

test('student order cards get medium from the ordered track rather than a renamed product', async () => {
  const find = jest.spyOn(db.Order, 'findAndCountAll').mockResolvedValue({ count: 1, rows: [{ id: 'order', OrderItems: [{ productNameSnapshot: 'Concept of ICT', CourseTrack: { Medium: { code: 'sinhala', nameEn: 'Sinhala' } } }] }] });
  const result = await listStudentOrders('student');
  expect(result.items[0].items[0]).toMatchObject({ name: 'Concept of ICT', medium: { code: 'sinhala', name: 'Sinhala' } });
  expect(find.mock.calls[0][0]).toMatchObject({ where: { userId: 'student' }, distinct: true, include: [{ model: db.OrderItem, include: [{ model: db.CourseTrack, include: [db.Medium] }] }] });
});

test('missing legacy medium data is not guessed from a product title', () => {
  expect(serializeOrder({ OrderItems: [{ name: 'Concept of ICT' }] }).items[0].medium).toBeNull();
});
