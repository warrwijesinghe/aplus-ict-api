import { jest } from '@jest/globals';
import { db } from '../src/models/index.js';
import { validateTutorialImage } from '../src/modules/content/tutorial-image.js';

const id = '11111111-1111-4111-8111-111111111111';
const image = { status: 'active', visibility: 'public', accessPolicy: 'public', category: 'lesson_image', mimeType: 'image/png' };
afterEach(() => jest.restoreAllMocks());

test('accepts a public image and permits clearing or leaving the selection unchanged', async () => {
  const find = jest.spyOn(db.Resource, 'findByPk').mockResolvedValue(image);
  await expect(validateTutorialImage({ tutorialImageResourceId: id })).resolves.toBeUndefined();
  await expect(validateTutorialImage({ tutorialImageResourceId: null })).resolves.toBeUndefined();
  await expect(validateTutorialImage({})).resolves.toBeUndefined();
  expect(find).toHaveBeenCalledTimes(1);
});

test.each([null, { visibility: 'private' }, { accessPolicy: 'premium' }, { status: 'archived' }, { deletedAt: new Date() }, { mimeType: 'application/pdf' }, { category: 'payment_slip' }])('rejects unavailable or non-public tutorial images: %j', async (overrides) => {
  jest.spyOn(db.Resource, 'findByPk').mockResolvedValue(overrides === null ? null : { ...image, ...overrides });
  await expect(validateTutorialImage({ tutorialImageResourceId: id })).rejects.toMatchObject({ status: 422 });
});

test('rejects malformed identifiers before querying resources', async () => {
  const find = jest.spyOn(db.Resource, 'findByPk');
  await expect(validateTutorialImage({ tutorialImageResourceId: 'invalid' })).rejects.toThrow('Select a valid tutorial image');
  expect(find).not.toHaveBeenCalled();
});
