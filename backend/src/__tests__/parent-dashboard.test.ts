/**
 * Parent dashboard tests — proves a parent can only access their linked child's data.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

describe('Parent Dashboard Authorization', () => {
  describe('GET /api/v1/parent/children/:studentId/progress', () => {
    it('should allow a parent to access their linked child\'s progress', async () => {
      const parentToken = generateTestToken(TEST_USERS.parent);

      // 1. Verify parent-student link → found
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      // 2. Get student info
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TEST_USERS.studentA.id, display_name: 'Test Student', grade_level: 3 }],
      });
      // 3. Get recent sessions
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/v1/parent/children/${TEST_USERS.studentA.id}/progress`)
        .set('Cookie', `token=${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.student).toBeDefined();
    });

    it('should deny a parent access to an unlinked child', async () => {
      const parentToken = generateTestToken(TEST_USERS.parentUnlinked);

      // Verify parent-student link → NOT found
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/v1/parent/children/${TEST_USERS.studentA.id}/progress`)
        .set('Cookie', `token=${parentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should deny a student accessing the parent dashboard', async () => {
      const studentToken = generateTestToken(TEST_USERS.studentA);

      const res = await request(app)
        .get(`/api/v1/parent/children/${TEST_USERS.studentA.id}/progress`)
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow an admin to access any child\'s progress', async () => {
      const adminToken = generateTestToken(TEST_USERS.admin);

      // Admin bypasses parent link check
      // 1. Get student info
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: TEST_USERS.studentA.id, display_name: 'Test Student', grade_level: 3 }],
      });
      // 2. Get recent sessions
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/v1/parent/children/${TEST_USERS.studentA.id}/progress`)
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/parent/children', () => {
    it('should return linked children for a parent', async () => {
      const parentToken = generateTestToken(TEST_USERS.parent);

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          display_name: 'Test Student',
          grade_level: 3,
          consent_granted: true,
          consent_date: new Date().toISOString(),
          session_count: 5,
          health_score: 72,
          latest_wpm: 85,
        }],
      });

      const res = await request(app)
        .get('/api/v1/parent/children')
        .set('Cookie', `token=${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.children).toHaveLength(1);
    });
  });
});
