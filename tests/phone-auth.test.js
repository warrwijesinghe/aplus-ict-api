import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { createPhoneAuthService, normalizeLoginPhone, validatePassword } from "../src/modules/auth/phone-auth.service.js";

// In-memory persistence tests service boundaries; deployment still needs a MariaDB migration.
const fixture = () => {
  const tables = {};
  const model = (name, defaults = {}) => {
    const rows = tables[name] = [];
    const matches = (row, where = {}) => Object.entries(where).every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value);
    const attach = (row) => Object.assign(row, { update: jest.fn(async (values) => Object.assign(row, values)) });
    return {
      rows,
      create: jest.fn(async (values) => { const row = attach({ id: crypto.randomUUID(), ...defaults, ...values }); rows.push(row); return row; }),
      findOne: jest.fn(async ({ where }) => rows.find((row) => matches(row, where)) || null),
      findAll: jest.fn(async () => []),
      update: jest.fn(async (values, { where }) => { for (const row of rows.filter((item) => matches(item, where))) Object.assign(row, values); }),
      async findOrCreate({ where, defaults: values }) { const existing = rows.find((row) => matches(row, where)); return existing ? [existing, false] : [await this.create(values), true]; },
      restore: (snapshot) => rows.splice(0, rows.length, ...snapshot.map(attach)),
    };
  };
  const models = {
    User: model('users', { authVersion: 0, phoneVerifiedAt: null }),
    PhoneChallenge: model('challenges', { attempts: 0, sendCount: 0 }),
    StudentProfile: model('profiles'), UserRole: model('userRoles'), Role: model('roles'), RefreshToken: model('refreshTokens'),
  };
  let pending = Promise.resolve();
  models.sequelize = { transaction: (action) => {
    const execute = async () => {
      const snapshots = new Map(Object.values(models).filter((m) => m.rows).map((m) => [m, m.rows.map((row) => ({ ...row }))]));
      try { return await action({ LOCK: { UPDATE: 'UPDATE' } }); }
      catch (error) { for (const [m, snapshot] of snapshots) m.restore(snapshot); throw error; }
    };
    const result = pending.then(execute); pending = result.catch(() => {}); return result;
  } };
  let timestamp = new Date('2026-09-12T08:00:00Z');
  const deliver = jest.fn(async () => ({ accepted: true }));
  const service = createPhoneAuthService({ models, deliver, smsConfig: () => ({ sender: 'APLUS' }), now: () => timestamp });
  const advance = (ms) => { timestamp = new Date(timestamp.getTime() + ms); };
  const latestCode = () => deliver.mock.calls.at(-1)[0].text.match(/\b\d{6}\b/)[0];
  return { models, service, deliver, advance, latestCode };
};

describe('phone account security', () => {
  let f;
  const phoneNumber = '0771234567';
  beforeEach(async () => {
    f = fixture();
    await f.models.Role.create({ code: 'student', isActive: true });
  });
  const verification = async (purpose = 'register') => {
    const challenge = await f.service.requestOtp({ phoneNumber, purpose });
    return { ...challenge, ...(await f.service.verifyOtp({ challengeId: challenge.challengeId, code: f.latestCode() })) };
  };
  const register = async () => f.service.register({ ...(await verification()), password: 'Learning123!', name: 'Student One' });

  it('normalizes local/international formats but rejects landlines and malformed input', () => {
    for (const phone of ['0771234567', '+94 77 123 4567', '94771234567']) expect(normalizeLoginPhone(phone)).toBe('94771234567');
    for (const phone of ['0112345678', '+11234567890', '947712345678', {}, null]) expect(() => normalizeLoginPhone(phone)).toThrow();
  });
  it('enforces password strength and bcrypt byte limits', () => {
    for (const password of ['short1', 'abcdefgh', '12345678', 'a1' + '🙂'.repeat(20)]) expect(() => validatePassword(password)).toThrow();
    expect(validatePassword('Learning123!')).toBe('Learning123!');
  });
  it('creates a verified student only after OTP and password setup, then supports phone login', async () => {
    const verified = await verification();
    expect(f.models.User.rows).toHaveLength(0);
    expect(verified).not.toHaveProperty('code');
    const user = await f.service.register({ ...verified, password: 'Learning123!', name: ' Student One ' });
    expect(user).toMatchObject({ phoneNumber: '94771234567', name: 'Student One', role: 'student' });
    expect(await bcrypt.compare('Learning123!', user.passwordHash)).toBe(true);
    expect(user.passwordHash).not.toBe('Learning123!');
    expect(f.models.StudentProfile.rows[0]).toMatchObject({ userId: user.id, mobileNumber: '0771234567' });
    expect(f.models.UserRole.rows[0].userId).toBe(user.id);
    expect((await f.service.login({ phoneNumber: '+94771234567', password: 'Learning123!' })).id).toBe(user.id);
    await expect(f.service.login({ phoneNumber, password: 'Wrong123!' })).rejects.toMatchObject({ status: 401 });
  });
  it('stores a keyed hash and does not return the code', async () => {
    const response = await f.service.requestOtp({ phoneNumber, purpose: 'register' });
    expect(JSON.stringify(response)).not.toContain(f.latestCode());
    expect(f.models.PhoneChallenge.rows[0].codeHash).toMatch(/^[a-f\d]{64}$/);
    expect(JSON.stringify(f.models.PhoneChallenge.rows)).not.toContain(f.latestCode());
  });
  it('commits incorrect attempts and locks a code after five guesses', async () => {
    const { challengeId } = await f.service.requestOtp({ phoneNumber, purpose: 'register' });
    for (let i = 0; i < 5; i++) await expect(f.service.verifyOtp({ challengeId, code: '000000' })).rejects.toMatchObject({ status: 422 });
    expect(f.models.PhoneChallenge.rows[0].attempts).toBe(5);
    await expect(f.service.verifyOtp({ challengeId, code: f.latestCode() })).rejects.toMatchObject({ status: 422 });
  });
  it('expires codes after five minutes', async () => {
    const { challengeId } = await f.service.requestOtp({ phoneNumber, purpose: 'register' });
    f.advance(300_000);
    await expect(f.service.verifyOtp({ challengeId, code: f.latestCode() })).rejects.toMatchObject({ status: 422 });
  });
  it('enforces resend cooldown and invalidates the preceding code', async () => {
    const first = await f.service.requestOtp({ phoneNumber, purpose: 'register' });
    const code = f.latestCode();
    await expect(f.service.requestOtp({ phoneNumber, purpose: 'register' })).rejects.toMatchObject({ status: 429 });
    f.advance(60_000);
    await f.service.requestOtp({ phoneNumber, purpose: 'register' });
    await expect(f.service.verifyOtp({ challengeId: first.challengeId, code })).rejects.toMatchObject({ status: 422 });
  });
  it('limits sends per phone even after cooldown, allowing a new hourly window', async () => {
    for (let i = 0; i < 5; i++) { await f.service.requestOtp({ phoneNumber, purpose: 'register' }); f.advance(60_000); }
    await expect(f.service.requestOtp({ phoneNumber, purpose: 'register' })).rejects.toMatchObject({ status: 429 });
    f.advance(3600_000);
    await expect(f.service.requestOtp({ phoneNumber, purpose: 'register' })).resolves.toHaveProperty('challengeId');
  });
  it('requires verified proof, purpose binding, and single-use completion', async () => {
    const proof = await verification();
    await expect(f.service.resetPassword({ ...proof, password: 'Learning123!' })).rejects.toMatchObject({ status: 422 });
    await expect(f.service.register({ ...proof, verificationToken: 'a'.repeat(64), name: 'Student', password: 'Learning123!' })).rejects.toMatchObject({ status: 422 });
    const input = { ...proof, name: 'Student', password: 'Learning123!' };
    const results = await Promise.allSettled([f.service.register(input), f.service.register(input)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(f.models.User.rows).toHaveLength(1);
  });
  it('will not exchange a verified code twice or accept expired password proof', async () => {
    const proof = await verification();
    await expect(f.service.verifyOtp({ challengeId: proof.challengeId, code: f.latestCode() })).rejects.toMatchObject({ status: 422 });
    f.advance(600_000);
    await expect(f.service.register({ ...proof, name: 'Student', password: 'Learning123!' })).rejects.toMatchObject({ status: 422 });
  });
  it('resets a password on the same user and revokes old sessions', async () => {
    const user = await register();
    await f.models.RefreshToken.create({ userId: user.id, revokedAt: null });
    const proof = await verification('reset');
    const updated = await f.service.resetPassword({ ...proof, password: 'NewPassword123!' });
    expect(updated.id).toBe(user.id);
    expect(updated.authVersion).toBe(1);
    expect(f.models.RefreshToken.rows[0].revokedAt).toBeInstanceOf(Date);
    await expect(f.service.login({ phoneNumber, password: 'Learning123!' })).rejects.toMatchObject({ status: 401 });
    await expect(f.service.login({ phoneNumber, password: 'NewPassword123!' })).resolves.toHaveProperty('id', user.id);
    await expect(f.service.resetPassword({ ...proof, password: 'Replay123!' })).rejects.toMatchObject({ status: 422 });
  });
  it('allows staff-assigned legacy students to verify and set a password with reset', async () => {
    await f.models.User.create({ phoneNumber: '94771234567', role: 'student', status: 'active' });
    const proof = await verification('reset');
    await f.service.resetPassword({ ...proof, password: 'Learning123!' });
    await expect(f.service.login({ phoneNumber, password: 'Learning123!' })).resolves.toHaveProperty('phoneVerifiedAt');
  });
  it('does not send reset codes for missing, disabled, or staff accounts', async () => {
    await f.service.requestOtp({ phoneNumber, purpose: 'reset' });
    expect(f.deliver).not.toHaveBeenCalled();
    const user = await f.models.User.create({ phoneNumber: '94771234567', role: 'student', status: 'disabled' });
    f.advance(60_000); await f.service.requestOtp({ phoneNumber, purpose: 'reset' });
    expect(f.deliver).not.toHaveBeenCalled();
    await user.update({ status: 'active' });
    f.models.UserRole.findAll.mockResolvedValue([{ role: 'admin' }]);
    f.advance(60_000); await f.service.requestOtp({ phoneNumber, purpose: 'reset' });
    expect(f.deliver).not.toHaveBeenCalled();
  });
  it('does not register an existing phone or expose account existence in responses', async () => {
    await register(); f.advance(60_000); f.deliver.mockClear();
    const response = await f.service.requestOtp({ phoneNumber, purpose: 'register' });
    expect(response).toMatchObject({ expiresIn: 300, resendAfter: 60 });
    expect(f.deliver).not.toHaveBeenCalled();
  });
  it('invalidates a challenge if SMS delivery fails', async () => {
    f.deliver.mockResolvedValue({ accepted: false });
    await expect(f.service.requestOtp({ phoneNumber, purpose: 'register' })).rejects.toMatchObject({ status: 503 });
    const row = f.models.PhoneChallenge.rows[0];
    expect(row.consumedAt).toBeInstanceOf(Date);
    expect(row.codeHash).toBeNull();
  });
  it('limits phone password attempts independently of IP', async () => {
    for (let i = 0; i < 15; i++) await expect(f.service.login({ phoneNumber, password: 'Wrong123!' })).rejects.toMatchObject({ status: 401 });
    await expect(f.service.login({ phoneNumber, password: 'Wrong123!' })).rejects.toMatchObject({ status: 429 });
    f.advance(15 * 60_000);
    await expect(f.service.login({ phoneNumber, password: 'Wrong123!' })).rejects.toMatchObject({ status: 401 });
  });
});
