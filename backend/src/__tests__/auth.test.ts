/**
 * Auth route tests — covers registration, login, JWT verification, and error masking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';

// Must import app AFTER setup mocks are in place
import app from '../server';

describe('Auth Routes', () => {
  // ---- Registration ----
  describe('POST /api/v1/auth/register', () => {
    it('should register a new student successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          email: 'new@decodex.com',
          role: 'student',
          display_name: 'New Student',
        }],
      });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'new@decodex.com',
          password: 'securepass123',
          display_name: 'New Student',
          date_of_birth: '2015-06-15',
          grade_level: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('new@decodex.com');
      expect(res.body.user.role).toBe('student');
      // httpOnly cookie should be set
      const setCookie = res.headers['set-cookie'];
      expect(setCookie).toBeDefined();
    });

    it('should reject duplicate email (409 CONFLICT)', async () => {
      mockQuery.mockRejectedValueOnce({ code: '23505' });

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'exists@decodex.com',
          password: 'securepass123',
          display_name: 'Duplicate',
          date_of_birth: '2015-06-15',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should reject missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@decodex.com' }); // missing password and display_name
        date_of_birth: '2015-06-15',

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'securepass123',
          display_name: 'Test',
          date_of_birth: '2015-06-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('email');
    });

    it('should reject password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@decodex.com',
          password: 'short',
          display_name: 'Test',
          date_of_birth: '2015-06-15',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('8 characters');
    });
  });

  // ---- Login ----
  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', 12);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          email: 'student@decodex.com',
          password_hash: passwordHash,
          role: 'student',
          display_name: 'Test Student',
        }],
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@decodex.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('student@decodex.com');
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const passwordHash = await bcrypt.hash('password123', 12);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          email: 'student@decodex.com',
          password_hash: passwordHash,
          role: 'student',
          display_name: 'Test Student',
        }],
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@decodex.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@decodex.com' }); // missing password

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ---- JWT Middleware ----
  describe('JWT verification middleware', () => {
    it('should reject requests with no token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid tokens', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', 'token=invalid-jwt-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_EXPIRED');
    });

    it('should accept a valid token and return user data', async () => {
      const token = generateTestToken(TEST_USERS.studentA);
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          email: 'student@decodex.com',
          role: 'student',
          display_name: 'Test Student',
        }],
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(TEST_USERS.studentA.id);
    });
  });

  // ---- PATCH /me (Update preferred_language) ----
  describe('PATCH /api/v1/auth/me', () => {
    const studentToken = generateTestToken(TEST_USERS.studentA);

    it('should update preferred_language to a valid supported language (hi)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          email: 'student@decodex.com',
          role: 'student',
          display_name: 'Test Student',
          preferred_language: 'hi',
        }],
      });

      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${studentToken}`)
        .send({ preferredLanguage: 'hi' });

      expect(res.status).toBe(200);
      expect(res.body.user.preferredLanguage).toBe('hi');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET preferred_language = $1'),
        ['hi', TEST_USERS.studentA.id]
      );
    });

    it('should update preferred_language to en', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          email: 'student@decodex.com',
          role: 'student',
          display_name: 'Test Student',
          preferred_language: 'en',
        }],
      });

      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${studentToken}`)
        .send({ preferredLanguage: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.user.preferredLanguage).toBe('en');
    });

    it('should reject unsupported language', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${studentToken}`)
        .send({ preferredLanguage: 'fr' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Unsupported language');
    });

    it('should reject missing preferredLanguage', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${studentToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('preferredLanguage is required');
    });

    it('should reject null preferredLanguage', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${studentToken}`)
        .send({ preferredLanguage: null });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('preferredLanguage is required');
    });

    it('should reject non-string preferredLanguage', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${studentToken}`)
        .send({ preferredLanguage: 123 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('must be a string');
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .send({ preferredLanguage: 'hi' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${studentToken}`)
        .send({ preferredLanguage: 'hi' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
