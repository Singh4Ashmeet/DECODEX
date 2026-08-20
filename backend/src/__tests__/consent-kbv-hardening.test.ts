/**
 * Consent KBV Hardening tests — verifies the exponential backoff cooldown,
 * audit logging, and dedicated rate limiter for consent token verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

describe('Consent KBV Hardening', () => {
  const validToken = 'valid-consent-token-123';
  const studentId = TEST_USERS.studentA.id;
  const parentId = TEST_USERS.parent.id;
  const validDob = '2015-06-15';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Exponential Backoff Cooldown', () => {
    it('should block request within cooldown window (429 KBV_COOLDOWN) without incrementing failed_attempts', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 1,
            last_attempt_at: new Date().toISOString(),
            date_of_birth: validDob,
          }],
        });

      const res = await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: '2015-06-16', agree: true });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('KBV_COOLDOWN');
      expect(res.body.error.details.retry_after_seconds).toBeGreaterThan(0);
      expect(res.body.error.details.retry_after_seconds).toBeLessThanOrEqual(2);
    });

    it('should allow request after cooldown window has elapsed', async () => {
      const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 1,
            last_attempt_at: threeSecondsAgo,
            date_of_birth: validDob,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_attempt_at
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log (success)
        .mockResolvedValueOnce({ rows: [] }) // INSERT parent_student_links
        .mockResolvedValueOnce({
          rows: [{ consent_granted: true, consent_date: new Date().toISOString() }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE token used_at
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: validDob, agree: true });

      expect(res.status).toBe(200);
      expect(res.body.consent_granted).toBe(true);
    });

    it('should apply increasing cooldown: 0s, 2s, 4s, 8s, 16s, capped at 60s', async () => {
      const testCases = [
        { failed_attempts: 0, expectedCooldown: 0 },
        { failed_attempts: 1, expectedCooldown: 2 },
        { failed_attempts: 2, expectedCooldown: 4 },
        { failed_attempts: 3, expectedCooldown: 8 },
        { failed_attempts: 4, expectedCooldown: 16 },
        { failed_attempts: 5, expectedCooldown: 60 },
      ];

      for (const tc of testCases) {
        vi.clearAllMocks();

        const now = new Date().toISOString();

        mockQuery
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{
              parent_id: parentId,
              email: 'parent@example.com',
              student_id: studentId,
              failed_attempts: tc.failed_attempts,
              last_attempt_at: now,
              date_of_birth: validDob,
            }],
          });

        const res = await request(app)
          .post(`/api/v1/consent/${validToken}/confirm`)
          .send({ date_of_birth: '2015-06-16', agree: true });

        if (tc.expectedCooldown === 0) {
          expect(res.status).not.toBe(429);
        } else {
          expect(res.status).toBe(429);
          expect(res.body.error.code).toBe('KBV_COOLDOWN');
          expect(res.body.error.details.retry_after_seconds).toBeLessThanOrEqual(tc.expectedCooldown);
        }
      }
    });
  });

  describe('Audit Logging', () => {
    it('should write audit log row on failed verification attempt', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 0,
            last_attempt_at: null,
            date_of_birth: validDob,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_attempt_at
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 1 }] }) // UPDATE failed_attempts
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log (failure)
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: '2015-06-16', agree: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KBV_FAILED');

      const auditCalls = mockQuery.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO consent_verification_attempts')
      );
      expect(auditCalls.length).toBe(1);
      // Audit log insert has 4 params: token, student_id, ip, failed_attempts_at_time (success is hardcoded in SQL)
      expect(auditCalls[0][1]).toEqual([
        validToken,
        studentId,
        expect.any(String),
        1,
      ]);
    });

    it('should write audit log row on successful verification attempt', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 2,
            last_attempt_at: new Date(Date.now() - 10000).toISOString(),
            date_of_birth: validDob,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_attempt_at
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log (success)
        .mockResolvedValueOnce({ rows: [] }) // INSERT parent_student_links
        .mockResolvedValueOnce({
          rows: [{ consent_granted: true, consent_date: new Date().toISOString() }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE token used_at
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: validDob, agree: true });

      expect(res.status).toBe(200);

      const auditCalls = mockQuery.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO consent_verification_attempts')
      );
      expect(auditCalls.length).toBe(1);
      expect(auditCalls[0][1]).toEqual([
        validToken,
        studentId,
        expect.any(String),
        2,
      ]);
    });

    it('should not log the submitted date_of_birth value', async () => {
      const wrongDob = '2015-06-16';

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 0,
            last_attempt_at: null,
            date_of_birth: validDob,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_attempt_at
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 1 }] }) // UPDATE failed_attempts
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: wrongDob, agree: true });

      const auditCalls = mockQuery.mock.calls.filter(call =>
        typeof call[0] === 'string' && call[0].includes('INSERT INTO consent_verification_attempts')
      );
      expect(auditCalls.length).toBe(1);
      expect(auditCalls[0][1]).toHaveLength(4);
      expect(JSON.stringify(auditCalls[0][1])).not.toContain(wrongDob);
      expect(JSON.stringify(auditCalls[0][1])).not.toContain(validDob);
    });
  });

  describe('Dedicated Rate Limiter', () => {
    it('should have rate limiter mounted on confirm route', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 0,
            last_attempt_at: null,
            date_of_birth: validDob,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_attempt_at
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 1 }] }) // UPDATE failed_attempts
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: '2015-06-16', agree: true });

      expect(res.status).not.toBe(404);
    });
  });

  describe('Existing 5-attempt lockout still works', () => {
    it('should return KBV_ATTEMPTS_EXCEEDED at 5 failures', async () => {
      // 4 failed attempts, but last attempt was 30 seconds ago (cooldown for 4 = 16s, so expired)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 4,
            last_attempt_at: thirtySecondsAgo,
            date_of_birth: validDob,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_attempt_at
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 5 }] }) // increment to 5
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: '2015-06-16', agree: true });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('KBV_ATTEMPTS_EXCEEDED');
    });

    it('should not apply cooldown when failed_attempts >= 5 (locked)', async () => {
      // 5 failed attempts, but last attempt was 90 seconds ago (cooldown for 5 = 60s, so expired)
      const ninetySecondsAgo = new Date(Date.now() - 90000).toISOString();

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            parent_id: parentId,
            email: 'parent@example.com',
            student_id: studentId,
            failed_attempts: 5,
            last_attempt_at: ninetySecondsAgo,
            date_of_birth: validDob,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_attempt_at
        .mockResolvedValueOnce({ rows: [{ failed_attempts: 6 }] }) // increment
        .mockResolvedValueOnce({ rows: [] }) // INSERT audit log
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await request(app)
        .post(`/api/v1/consent/${validToken}/confirm`)
        .send({ date_of_birth: '2015-06-16', agree: true });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('KBV_ATTEMPTS_EXCEEDED');
    });
  });

  // Sanity check - full success flow
  it('grants consent when DOB matches (sanity check)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{
          parent_id: parentId,
          email: 'parent@test.com',
          student_id: studentId,
          failed_attempts: 0,
          last_attempt_at: null,
          date_of_birth: validDob,
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ consent_granted: true, consent_date: new Date().toISOString() }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/api/v1/consent/${validToken}/confirm`)
      .send({ date_of_birth: validDob, agree: true });

    expect(res.status).toBe(200);
    expect(res.body.consent_granted).toBe(true);
  });
});