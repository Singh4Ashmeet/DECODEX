/**
 * Sessions IDOR tests — proves the security fixes from Section 1c work.
 * A student CANNOT access another student's SSE stream or complete their drill.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';
import { vi } from 'vitest';

vi.mock('../services/gamification', () => ({
  recordDrillCompletion: vi.fn().mockResolvedValue(undefined),
}));

describe('Sessions IDOR Protection', () => {
  // ---- SSE Stream Ownership ----
  describe('GET /api/v1/sessions/:id/status/stream', () => {
    it('should deny a student access to another student\'s session stream', async () => {
      const tokenA = generateTestToken(TEST_USERS.studentA);
      const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      // Session belongs to studentB
      mockQuery.mockResolvedValueOnce({
        rows: [{ student_id: TEST_USERS.studentB.id }],
      });

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/status/stream`)
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow a student to access their own session stream', async () => {
      const tokenA = generateTestToken(TEST_USERS.studentA);
      const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      // Session belongs to studentA
      mockQuery.mockResolvedValueOnce({
        rows: [{ student_id: TEST_USERS.studentA.id }],
      });

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const response = await fetch(`http://localhost:${port}/api/v1/sessions/${sessionId}/status/stream`, {
          headers: { Cookie: `token=${tokenA}` },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');
      } finally {
        server.close();
      }
    });

    it('should return 404 for a non-existent session', async () => {
      const tokenA = generateTestToken(TEST_USERS.studentA);

      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/v1/sessions/nonexistent-id/status/stream')
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('should allow a teacher to access any student\'s session stream', async () => {
      const teacherToken = generateTestToken(TEST_USERS.teacher);
      const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      // Session belongs to studentA
      mockQuery.mockResolvedValueOnce({
        rows: [{ student_id: TEST_USERS.studentA.id }],
      });

      const server = app.listen(0);
      const port = (server.address() as any).port;

      try {
        const response = await fetch(`http://localhost:${port}/api/v1/sessions/${sessionId}/status/stream`, {
          headers: { Cookie: `token=${teacherToken}` },
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');
      } finally {
        server.close();
      }
    });
  });

  // ---- Drill Complete Ownership ----
  describe('POST /api/v1/sessions/drills/:id/complete', () => {
    it('should deny a student completing another student\'s drill', async () => {
      const tokenA = generateTestToken(TEST_USERS.studentA);
      const drillId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

      // The ownership-scoped lookup returns no rows (drill belongs to studentB)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/sessions/drills/${drillId}/complete`)
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should allow a student to complete their own drill', async () => {
      const tokenA = generateTestToken(TEST_USERS.studentA);
      const drillId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: drillId,
          completed: false,
          student_id: TEST_USERS.studentA.id,
        }],
      }).mockResolvedValueOnce({ rows: [{ id: drillId, completed: true }] });

      const res = await request(app)
        .post(`/api/v1/sessions/drills/${drillId}/complete`)
        .set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow a teacher to complete any drill', async () => {
      const teacherToken = generateTestToken(TEST_USERS.teacher);
      const drillId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: drillId,
          completed: false,
          student_id: TEST_USERS.studentA.id,
        }],
      }).mockResolvedValueOnce({ rows: [{ id: drillId, completed: true }] });

      const res = await request(app)
        .post(`/api/v1/sessions/drills/${drillId}/complete`)
        .set('Cookie', `token=${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
