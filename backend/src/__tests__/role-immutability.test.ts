/**
 * Role Immutability Tests — SEC-10
 * 
 * SEC-10: Student cannot modify their own role to 'teacher' (403 Forbidden)
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

describe('Role Immutability (SEC-10)', () => {
  const studentToken = generateTestToken(TEST_USERS.studentA);
  const teacherToken = generateTestToken(TEST_USERS.teacher);
  const adminToken = generateTestToken(TEST_USERS.admin);
  const parentToken = generateTestToken(TEST_USERS.parent);

  // ────────────────────────────────────────────────────────────────────────────
  // PATCH /api/v1/auth/me - preferred_language only
  // ────────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/v1/auth/me — role field rejection', () => {
    it('should reject role field in request body for student', async () => {
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
        .send({ preferredLanguage: 'hi', role: 'teacher' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Role cannot be modified');
    });

    it('should reject role field in request body for teacher', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.teacher.id,
          email: 'teacher@decodex.com',
          role: 'teacher',
          display_name: 'Test Teacher',
          preferred_language: 'en',
        }],
      });

      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${teacherToken}`)
        .send({ preferredLanguage: 'en', role: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject role field in request body for parent', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.parent.id,
          email: 'parent@decodex.com',
          role: 'parent',
          display_name: 'Test Parent',
          preferred_language: 'en',
        }],
      });

      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${parentToken}`)
        .send({ preferredLanguage: 'en', role: 'teacher' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid preferredLanguage update without role', async () => {
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
      expect(res.body.user.role).toBe('student'); // Role unchanged
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Registration - role is forced to 'student' or 'parent'
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/register — role enforcement', () => {
    it('should ignore role field and default to student', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'new-student-id',
          email: 'new@decodex.com',
          role: 'student', // Must be student
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
          role: 'teacher', // Attempted injection
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.role).not.toBe('teacher');
    });

    it('should ignore role field in parent registration', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'new-parent-id',
          email: 'newparent@decodex.com',
          role: 'parent', // Must be parent
          display_name: 'New Parent',
        }],
      });

      const res = await request(app)
        .post('/api/v1/auth/register/parent')
        .send({
          email: 'newparent@decodex.com',
          password: 'securepass123',
          display_name: 'New Parent',
          role: 'admin', // Attempted injection
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('parent');
      expect(res.body.user.role).not.toBe('admin');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // No role-change endpoint exists
  // ────────────────────────────────────────────────────────────────────────────
  describe('No role modification endpoints', () => {
    it('should return 404 for PUT /api/v1/users/:id/role', async () => {
      const res = await request(app)
        .put('/api/v1/users/some-id/role')
        .set('Cookie', `token=${adminToken}`)
        .send({ role: 'teacher' });

      expect(res.status).toBe(404);
    });

    it('should return 404 for PATCH /api/v1/users/:id with role', async () => {
      const res = await request(app)
        .patch('/api/v1/users/some-id')
        .set('Cookie', `token=${adminToken}`)
        .send({ role: 'teacher' });

      expect(res.status).toBe(404);
    });

    it('should return 404 for POST /api/v1/auth/change-role', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-role')
        .set('Cookie', `token=${studentToken}`)
        .send({ role: 'teacher' });

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Admin-only user management (if exists) should be separate
  // ────────────────────────────────────────────────────────────────────────────
  describe('Admin user management (if implemented)', () => {
    it('should not have a role-change endpoint for self', async () => {
      // Even admin cannot change their own role via API
      const res = await request(app)
        .patch('/api/v1/auth/me')
        .set('Cookie', `token=${adminToken}`)
        .send({ role: 'student' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});