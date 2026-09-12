import { afterEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { db } from "../src/models/index.js";
import { env } from "../src/config/env.js";
import { phoneAuth } from "../src/modules/auth/phone-auth.service.js";

afterEach(() => jest.restoreAllMocks());
const student = { id: 'student-phone', name: 'Student', email: null, phoneNumber: '94771234567', role: 'student', status: 'active', authVersion: 1, Roles: [] };

describe('phone auth HTTP boundary', () => {
  it('removes both Google authentication endpoints', async () => {
    expect((await request(app).get('/api/v1/auth/google')).status).toBe(404);
    expect((await request(app).get('/api/v1/auth/google/callback?code=unused')).status).toBe(404);
  });
  it('returns normal sessions with unique refresh cookies and no credential fields', async () => {
    jest.spyOn(phoneAuth, 'login').mockResolvedValue(student);
    jest.spyOn(db.User, 'findByPk').mockResolvedValue(student);
    const createToken = jest.spyOn(db.RefreshToken, 'create').mockResolvedValue({});
    const first = await request(app).post('/api/v1/auth/phone/login').send({ phoneNumber: '0771234567', password: 'Learning123!' });
    const second = await request(app).post('/api/v1/auth/phone/login').send({ phoneNumber: '0771234567', password: 'Learning123!' });
    expect(first.status).toBe(200);
    expect(first.body.data.user).toMatchObject({ phoneNumber: student.phoneNumber, roles: ['student'] });
    expect(first.body.data.user).not.toHaveProperty('passwordHash');
    expect(jwt.verify(first.body.data.accessToken, env.accessSecret)).toMatchObject({ sub: student.id, ver: 1 });
    expect(first.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(second.headers['set-cookie'][0]).not.toEqual(first.headers['set-cookie'][0]);
    expect(createToken.mock.calls[0][0].tokenHash).toMatch(/^[a-f\d]{64}$/);
  });
  it('rejects access tokens from before a password reset', async () => {
    jest.spyOn(db.User, 'findByPk').mockResolvedValue(student);
    const oldToken = jwt.sign({ sub: student.id, role: 'student', ver: 0 }, env.accessSecret);
    const response = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/Session expired/);
  });
  it('rejects old refresh tokens even if a previously fetched record was not revoked', async () => {
    const token = jwt.sign({ sub: student.id, type: 'refresh', ver: 0 }, env.refreshSecret);
    jest.spyOn(db.RefreshToken, 'findOne').mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000), update: jest.fn() });
    jest.spyOn(db.User, 'findByPk').mockResolvedValue(student);
    const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', `aplus_refresh=${token}`);
    expect(response.status).toBe(401);
  });
  it('returns rate limits before repeated requests reach the OTP service', async () => {
    const send = jest.spyOn(phoneAuth, 'requestOtp').mockResolvedValue({ challengeId: 'opaque' });
    for (let i = 0; i < 20; i++) await request(app).post('/api/v1/auth/phone/otp').send({ phoneNumber: '0771234567', purpose: 'register' });
    expect((await request(app).post('/api/v1/auth/phone/otp').send({})).status).toBe(429);
    expect(send).toHaveBeenCalledTimes(20);
  });
});
