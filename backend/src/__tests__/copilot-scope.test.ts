/**
 * Copilot scope tests — proves the teacher-student school-based scope check works.
 * A teacher without a shared school_id cannot access a student's copilot data.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

// Mock all the database calls that generateStrategy makes
vi.mock('../services/healthScore', () => ({
  getLatestHealthScore: vi.fn().mockResolvedValue({ score: 65, riskLevel: 'moderate' }),
  computeHealthScore: vi.fn(),
  getHealthScoreHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/riskScreening', () => ({
  getLatestScreening: vi.fn().mockResolvedValue({ risk: 'moderate', confidence: 80 }),
  runRiskScreening: vi.fn(),
}));

vi.mock('../queue/consentErasure', () => ({
  eraseConsentDataForLink: vi.fn(),
  scheduleConsentErasureJob: vi.fn().mockResolvedValue(undefined),
  eraseExpiredConsentData: vi.fn().mockResolvedValue(undefined),
}));

describe('Copilot Teacher-Student Scope Check', () => {
  describe('POST /api/v1/copilot/:studentId/strategy', () => {
    it('should deny a teacher without school relationship', async () => {
      const teacherToken = generateTestToken(TEST_USERS.teacher);

      // First query: teacher_student_links returns no rows (no explicit link)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Second query: school_id fallback returns no rows (no school relationship)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/copilot/${TEST_USERS.studentA.id}/strategy`)
        .set('Cookie', `token=${teacherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Not assigned');
    });

    it('should allow a teacher with school relationship', async () => {
      const teacherToken = generateTestToken(TEST_USERS.teacher);

      // First query: teacher_student_links returns no rows (no explicit link)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Second query: school_id fallback returns a matching row (school relationship exists)
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      // Mock all subsequent DB calls for generateStrategy
      mockQuery.mockResolvedValueOnce({ rows: [{ display_name: 'Test Student', grade_level: 3 }] }); // student data
      mockQuery.mockResolvedValueOnce({
        rows: [{ rev: '0', sub: '0', omi: '0', ins: '0', bld: '0', pac: '0', uncertain: '0', total_errors: '0', total_words: '0', session_count: '0' }]
      }); // error aggregation
      mockQuery.mockResolvedValueOnce({ rows: [] }); // trends
      mockQuery.mockResolvedValueOnce({ rows: [{ preferred_language: 'en' }] }); // parent language
      mockQuery.mockResolvedValueOnce({ rows: [] }); // copilot session insert

      const res = await request(app)
        .post(`/api/v1/copilot/${TEST_USERS.studentA.id}/strategy`)
        .set('Cookie', `token=${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.strategy).toBeDefined();
    });

    it('should allow an admin without school check', async () => {
      const adminToken = generateTestToken(TEST_USERS.admin);

      // Admin bypasses the scope check entirely — no mockQuery needed for scope

      // Mock all subsequent DB calls for generateStrategy
      mockQuery.mockResolvedValueOnce({ rows: [{ display_name: 'Test Student', grade_level: 3 }] }); // student data
      mockQuery.mockResolvedValueOnce({
        rows: [{ rev: '0', sub: '0', omi: '0', ins: '0', bld: '0', pac: '0', uncertain: '0', total_errors: '0', total_words: '0', session_count: '0' }]
      }); // error aggregation
      mockQuery.mockResolvedValueOnce({ rows: [] }); // trends
      mockQuery.mockResolvedValueOnce({ rows: [{ preferred_language: 'en' }] }); // parent language
      mockQuery.mockResolvedValueOnce({ rows: [] }); // copilot session insert

      const res = await request(app)
        .post(`/api/v1/copilot/${TEST_USERS.studentA.id}/strategy`)
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/copilot/:studentId/history', () => {
    it('should deny a teacher without school relationship', async () => {
      const teacherToken = generateTestToken(TEST_USERS.teacher);

      // First query: teacher_student_links returns no rows (no explicit link)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // Second query: school_id fallback returns no rows (no school relationship)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/api/v1/copilot/${TEST_USERS.studentA.id}/history`)
        .set('Cookie', `token=${teacherToken}`);

      expect(res.status).toBe(403);
    });

    it('should deny a student trying to access copilot', async () => {
      const studentToken = generateTestToken(TEST_USERS.studentA);

      const res = await request(app)
        .get(`/api/v1/copilot/${TEST_USERS.studentA.id}/history`)
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});