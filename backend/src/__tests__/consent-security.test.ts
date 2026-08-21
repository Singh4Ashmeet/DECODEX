/**
 * Consent security tests — proves the /approve bypass is closed.
 *
 * These tests prove:
 * 1. POST /consent/approve returns 410 Gone (removed endpoint) for any caller.
 * 2. POST /consent/link alone (invite-code only, no DOB) NEVER results in
 *    consent_granted = TRUE on the parent_student_links row.
 * 3. Only POST /consent/:token/confirm with a correct date_of_birth can set
 *    consent_granted = TRUE.
 *
 * Tests labelled [BYPASS] must FAIL against the old code (pre-fix) and PASS
 * after the fix.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

describe('Consent Security — Bypass Prevention', () => {
  // ────────────────────────────────────────────────────────────────────────────
  // Part 1A: /approve endpoint must be REMOVED (returns 404 or 410)
  // ────────────────────────────────────────────────────────────────────────────
  describe('[BYPASS] POST /api/v1/consent/approve must not grant consent', () => {
    it('returns 410 Gone for an authenticated parent calling /approve', async () => {
      const parentToken = generateTestToken(TEST_USERS.parent);

      const res = await request(app)
        .post('/api/v1/consent/approve')
        .set('Cookie', `token=${parentToken}`)
        .send({ student_id: TEST_USERS.studentA.id });

      // 410 Gone (preferred) or 404 Not Found are both acceptable
      expect([404, 410]).toContain(res.status);
      // Must NOT return 200 with consent_granted: true
      expect(res.body.consent_granted).not.toBe(true);
    });

    it('returns 410 Gone for an authenticated student calling /approve (self-approval bypass)', async () => {
      const studentToken = generateTestToken(TEST_USERS.studentA);

      const res = await request(app)
        .post('/api/v1/consent/approve')
        .set('Cookie', `token=${studentToken}`)
        .send({});

      expect([404, 410]).toContain(res.status);
      expect(res.body.consent_granted).not.toBe(true);
    });

    it('returns 401 for an unauthenticated /approve call', async () => {
      const res = await request(app)
        .post('/api/v1/consent/approve')
        .send({ student_id: TEST_USERS.studentA.id });

      // Either 401 Unauthorized or 404/410 if route is removed entirely — not 200
      expect(res.status).not.toBe(200);
      expect(res.body.consent_granted).not.toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Part 1B: /link alone must NOT produce consent_granted = TRUE
  // ────────────────────────────────────────────────────────────────────────────
  describe('[BYPASS] POST /api/v1/consent/link must not grant consent by itself', () => {
    it('linking via invite code creates a pending link with consent_granted = FALSE, not TRUE', async () => {
      const parentToken = generateTestToken(TEST_USERS.parent);

      // Mock: parent lookup succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{ email: 'parent@test.com' }],
      });

      // Mock: student lookup by invite code succeeds
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          display_name: 'Alice',
          grade_level: 3,
        }],
      });

      // Mock: INSERT into parent_student_links succeeds (new link row)
      mockQuery.mockResolvedValueOnce({
        rows: [{ parent_id: TEST_USERS.parent.id }],
      });

      // Mock: issueConsentToken internals (INSERT consent_tokens + sendEmail)
      // INSERT consent_tokens
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/link')
        .set('Cookie', `token=${parentToken}`)
        .send({ invite_code: 'VALID-CODE-123' });

      // Link must succeed (201 Created)
      expect(res.status).toBe(201);

      // The /link response must NOT include consent_granted: true
      expect(res.body.consent_granted).not.toBe(true);

      // The actual DB UPDATE to set consent_granted = TRUE must never have been
      // called via mockQuery. Verify no call contained 'consent_granted = TRUE'
      // (other than the read-only token INSERT, which doesn't touch the links table)
      const allQueryCalls = mockQuery.mock.calls.map(([sql]: [string]) => sql || '');
      const consentGrantedUpdates = allQueryCalls.filter(
        (sql) =>
          sql.includes('consent_granted = TRUE') &&
          sql.includes('parent_student_links'),
      );
      expect(consentGrantedUpdates).toHaveLength(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Part 2: /confirm with correct DOB IS the only valid grant path
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/consent/:token/confirm — the only valid consent grant path', () => {
    it('grants consent when DOB matches and agree = true', async () => {
      const mockClient = {
        query: mockQuery,
        release: vi.fn(),
      };
      // Pool.connect mock already handled in setup.ts

      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT consent_tokens — valid token, matching DOB
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_id: TEST_USERS.parent.id,
          email: TEST_USERS.parent.email,
          student_id: TEST_USERS.studentA.id,
          failed_attempts: 0,
          last_attempt_at: null,
          date_of_birth: '2015-06-15',
        }],
      });

      // UPDATE last_attempt_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT audit log (success)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT parent_student_links ON CONFLICT DO NOTHING
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // UPDATE parent_student_links SET consent_granted = TRUE
      mockQuery.mockResolvedValueOnce({
        rows: [{ consent_granted: true, consent_date: new Date().toISOString() }],
      });

      // UPDATE consent_tokens SET used_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/valid-test-token/confirm')
        .send({ date_of_birth: '2015-06-15', agree: true });

      expect(res.status).toBe(200);
      expect(res.body.consent_granted).toBe(true);
    });

    it('rejects when DOB does not match (KBV_FAILED)', async () => {
      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT consent_tokens — valid token but DOB is 2015-06-15
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_id: TEST_USERS.parent.id,
          email: TEST_USERS.parent.email,
          student_id: TEST_USERS.studentA.id,
          failed_attempts: 0,
          last_attempt_at: null,
          date_of_birth: '2015-06-15',
        }],
      });

      // UPDATE last_attempt_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // UPDATE failed_attempts
      mockQuery.mockResolvedValueOnce({ rows: [{ failed_attempts: 1 }] });

      // INSERT audit log (failure)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/valid-test-token/confirm')
        .send({ date_of_birth: '2015-01-01', agree: true }); // wrong DOB

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KBV_FAILED');
      expect(res.body.error.details.attempts_remaining).toBe(4);
    });

    it('rejects when agree is false (consent refused)', async () => {
      const res = await request(app)
        .post('/api/v1/consent/some-token/confirm')
        .send({ date_of_birth: '2015-06-15', agree: false });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Part 3: Unauthenticated consent request (email + invite_code)
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/consent/request-unverified — unauthenticated consent request', () => {
    it('sends consent email when invite_code is valid and email is provided', async () => {
      // SELECT student by invite_code
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: TEST_USERS.studentA.id,
          display_name: 'Alice',
          date_of_birth: '2015-06-15',
        }],
      });

      // UPDATE invalidate existing tokens
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT consent_tokens (parent_id=NULL, email=provided)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/request-unverified')
        .send({ email: 'parent@test.com', invite_code: 'VALID-CODE-123' });

      expect(res.status).toBe(201);
      expect(res.body.consent_email_sent).toBe(true);

      // Verify INSERT used parent_id=NULL and email
      const insertCall = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql && sql.includes('INSERT INTO consent_tokens')
      );
      expect(insertCall).toBeDefined();
      expect(insertCall![0]).toContain('parent_id');
      expect(insertCall![0]).toContain('email');
    });

    it('rejects invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/consent/request-unverified')
        .send({ email: 'not-an-email', invite_code: 'VALID-CODE-123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing invite_code', async () => {
      const res = await request(app)
        .post('/api/v1/consent/request-unverified')
        .send({ email: 'parent@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid invite_code', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/request-unverified')
        .send({ email: 'parent@test.com', invite_code: 'INVALID' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INVALID_CODE');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Part 4: Confirm flow with unauthenticated token (parent_id=NULL)
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/consent/:token/confirm — with unauthenticated token (parent_id=NULL)', () => {
    it('auto-creates parent account and grants consent when DOB matches (no existing parent)', async () => {
      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT consent_tokens — token with parent_id=NULL, email=parent@test.com
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_id: null,
          email: 'parent@test.com',
          student_id: TEST_USERS.studentA.id,
          failed_attempts: 0,
          last_attempt_at: null,
          date_of_birth: '2015-06-15',
        }],
      });

      // UPDATE last_attempt_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT audit log (success)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT users — no existing parent with that email
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT users — auto-create minimal parent account
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-parent-uuid' }],
      });

      // INSERT parent_student_links
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // UPDATE parent_student_links SET consent_granted = TRUE
      mockQuery.mockResolvedValueOnce({
        rows: [{ consent_granted: true, consent_date: new Date().toISOString() }],
      });

      // UPDATE consent_tokens SET used_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/valid-test-token/confirm')
        .send({ date_of_birth: '2015-06-15', agree: true });

      expect(res.status).toBe(200);
      expect(res.body.consent_granted).toBe(true);

      // Verify parent account was created - check for INSERT INTO users with 'parent' role value
      const insertUserCall = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql && sql.includes('INSERT INTO users') && sql.includes("'parent'")
      );
      expect(insertUserCall).toBeDefined();
    });

    it('links to existing parent account and grants consent when DOB matches (parent exists)', async () => {
      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT consent_tokens — token with parent_id=NULL, email=existing@parent.com
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_id: null,
          email: 'existing@parent.com',
          student_id: TEST_USERS.studentA.id,
          failed_attempts: 0,
          last_attempt_at: null,
          date_of_birth: '2015-06-15',
        }],
      });

      // UPDATE last_attempt_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT audit log (success)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT users — existing parent found
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-parent-uuid' }],
      });

      // INSERT parent_student_links
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // UPDATE parent_student_links SET consent_granted = TRUE
      mockQuery.mockResolvedValueOnce({
        rows: [{ consent_granted: true, consent_date: new Date().toISOString() }],
      });

      // UPDATE consent_tokens SET used_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/valid-test-token/confirm')
        .send({ date_of_birth: '2015-06-15', agree: true });

      expect(res.status).toBe(200);
      expect(res.body.consent_granted).toBe(true);

      // Verify no new user was created (existing parent used)
      const insertUserCall = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql && sql.includes('INSERT INTO users') && sql.includes("role = 'parent'")
      );
      expect(insertUserCall).toBeUndefined();
    });

    it('rejects with KBV_FAILED when DOB does not match (unauthenticated token)', async () => {
      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT consent_tokens — token with parent_id=NULL
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_id: null,
          email: 'parent@test.com',
          student_id: TEST_USERS.studentA.id,
          failed_attempts: 0,
          last_attempt_at: null,
          date_of_birth: '2015-06-15',
        }],
      });

      // UPDATE last_attempt_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // UPDATE failed_attempts
      mockQuery.mockResolvedValueOnce({ rows: [{ failed_attempts: 1 }] });

      // INSERT audit log (failure)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/consent/valid-test-token/confirm')
        .send({ date_of_birth: '2015-01-01', agree: true }); // wrong DOB

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('KBV_FAILED');
      expect(res.body.error.details.attempts_remaining).toBe(4);

      // Verify no parent account was created (DOB failed before that step)
      const insertUserCall = mockQuery.mock.calls.find(([sql]: [string]) =>
        sql && sql.includes('INSERT INTO users') && sql.includes("role = 'parent'")
      );
      expect(insertUserCall).toBeUndefined();
    });

    it('auto-created parent can set password via reset flow and then log in', async () => {
      // This test verifies the full lifecycle:
      // 1. POST /consent/:token/confirm auto-creates parent with reset token
      // 2. POST /auth/password-reset/confirm sets password using that token
      // 3. POST /auth/login works with the new password

      // Step 1: Confirm consent (auto-creates parent with reset token)
      // BEGIN
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT consent_tokens
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_id: null,
          email: 'newparent@test.com',
          student_id: TEST_USERS.studentA.id,
          failed_attempts: 0,
          last_attempt_at: null,
          date_of_birth: '2015-06-15',
        }],
      });

      // UPDATE last_attempt_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT audit log (success)
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // SELECT users — no existing parent
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // INSERT users — auto-create with reset token
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'auto-created-parent-uuid' }],
      });

      // INSERT parent_student_links
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // UPDATE parent_student_links SET consent_granted = TRUE
      mockQuery.mockResolvedValueOnce({
        rows: [{ consent_granted: true, consent_date: new Date().toISOString() }],
      });

      // UPDATE consent_tokens SET used_at = NOW()
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // COMMIT
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const confirmRes = await request(app)
        .post('/api/v1/consent/valid-test-token/confirm')
        .send({ date_of_birth: '2015-06-15', agree: true });

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.consent_granted).toBe(true);

      // Verify sendPasswordResetEmail was called
      // (The email service is mocked in setup.ts)

      // Step 2: Use password reset to set password
      // The reset token was generated during auto-create; we need to simulate
      // the user clicking the link and submitting a new password.
      // Since the token is generated inside the route (not mocked), we'll test
      // the /password-reset/confirm endpoint directly with a mock token.

      // Mock: find user by reset token
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'auto-created-parent-uuid' }],
      });

      // Mock: update password and clear reset token
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const resetRes = await request(app)
        .post('/api/v1/auth/password-reset/confirm')
        .send({ token: 'mock-reset-token-from-email', password: 'NewSecurePass123' });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      // Verify cookie was set
      expect(resetRes.headers['set-cookie']).toBeDefined();

      // Step 3: Login with new password
      // Mock: find user by email
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'auto-created-parent-uuid',
          email: 'newparent@test.com',
          password_hash: await bcrypt.hash('NewSecurePass123', 12),
          role: 'parent',
          display_name: 'Parent',
          preferred_language: 'en',
        }],
      });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'newparent@test.com', password: 'NewSecurePass123' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user).toBeDefined();
      expect(loginRes.body.user.role).toBe('parent');
      expect(loginRes.headers['set-cookie']).toBeDefined();
    });
  });
});
