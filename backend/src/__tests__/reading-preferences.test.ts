/**
 * Reading Preferences route tests — covers GET/PUT endpoints with validation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';

// Must import app AFTER setup mocks are in place
import app from '../server';

describe('Reading Preferences Routes', () => {
  const studentToken = generateTestToken(TEST_USERS.studentA);
  const authHeaders = { Cookie: `token=${studentToken}` };

  const defaultPrefs = { fontScale: 1, lineSpacing: 1, letterSpacing: 0 };
  const validPrefs = { fontScale: 1.2, lineSpacing: 1.5, letterSpacing: 0.02 };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/students/me/reading-preferences', () => {
    it('should return default preferences when column is null', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ reading_preferences: null }],
      });

      const res = await request(app)
        .get('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie);

      expect(res.status).toBe(200);
      expect(res.body.preferences).toEqual(defaultPrefs);
    });

    it('should return stored preferences when present', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ reading_preferences: validPrefs }],
      });

      const res = await request(app)
        .get('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie);

      expect(res.status).toBe(200);
      expect(res.body.preferences).toEqual(validPrefs);
    });

    it('should return 404 for non-student user', async () => {
      const teacherToken = generateTestToken(TEST_USERS.teacher);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/students/me/reading-preferences')
        .set('Cookie', `token=${teacherToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/students/me/reading-preferences', () => {
    it('should persist valid preferences and return them', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ reading_preferences: validPrefs }],
      });

      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send(validPrefs);

      expect(res.status).toBe(200);
      expect(res.body.preferences).toEqual(validPrefs);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET reading_preferences'),
        [JSON.stringify(validPrefs), TEST_USERS.studentA.id, 'student']
      );
    });

    it('should reject fontScale below minimum (0.85)', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send({ ...validPrefs, fontScale: 0.8 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject fontScale above maximum (1.5)', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send({ ...validPrefs, fontScale: 1.6 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject lineSpacing below minimum (1)', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send({ ...validPrefs, lineSpacing: 0.5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject lineSpacing above maximum (2)', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send({ ...validPrefs, lineSpacing: 2.5 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject letterSpacing below minimum (0)', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send({ ...validPrefs, letterSpacing: -0.01 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject letterSpacing above maximum (0.05)', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send({ ...validPrefs, letterSpacing: 0.06 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-numeric values', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', authHeaders.Cookie)
        .send({ ...validPrefs, fontScale: 'large' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-student user', async () => {
      const teacherToken = generateTestToken(TEST_USERS.teacher);
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/v1/students/me/reading-preferences')
        .set('Cookie', `token=${teacherToken}`)
        .send(validPrefs);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});