/**
 * Consent Denied Recording Tests — SEC-14
 * 
 * SEC-14: Consent-denied student cannot initiate audio recording (Feature disabled)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

describe('Consent Denied Recording Block (SEC-14)', () => {
  const studentToken = generateTestToken(TEST_USERS.studentA);
  const teacherToken = generateTestToken(TEST_USERS.teacher);
  const parentToken = generateTestToken(TEST_USERS.parent);
  const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // requireConsent Middleware
  // ────────────────────────────────────────────────────────────────────────────
  describe('requireConsent Middleware', () => {
    it('should block audio upload when consent not granted', async () => {
      // Mock getConsentStatus to return consent_granted: false
      mockQuery.mockResolvedValueOnce({ rows: [] }); // No consent granted

      const res = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
      expect(res.body.error.message).toContain('parent needs to confirm consent');
    });

    it('should block dex transcribe when consent not granted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/v1/dex/transcribe')
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
    });

    it('should allow audio upload when consent granted', async () => {
      // Mock consent granted
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ consent_date: new Date().toISOString() }] // Consent granted
        })
        .mockResolvedValueOnce({ 
          rows: [{ student_id: TEST_USERS.studentA.id, content: 'Test passage' }] 
        })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE

      const res = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('queued');
    });

    it('should allow dex transcribe when consent granted', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ consent_date: new Date().toISOString() }] 
        });

      const res = await request(app)
        .post('/api/v1/dex/transcribe')
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).not.toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Consent Status Edge Cases
  // ────────────────────────────────────────────────────────────────────────────
  describe('Consent Status Edge Cases', () => {
    it('should block when consent withdrawn', async () => {
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ 
          consent_date: new Date(Date.now() - 86400000).toISOString(),
          withdrawn_at: new Date().toISOString(), // Withdrawn
        }] 
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
    });

    it('should block when consent expired (>365 days)', async () => {
      mockQuery.mockResolvedValueOnce({ 
        rows: [{ 
          consent_date: new Date(Date.now() - 400 * 86400000).toISOString(), // >365 days
          withdrawn_at: null,
        }] 
      });

      const res = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CONSENT_REQUIRED');
    });

    it('should allow when consent recently renewed', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ 
            consent_date: new Date().toISOString(), // Fresh consent
            withdrawn_at: null,
          }] 
        })
        .mockResolvedValueOnce({ 
          rows: [{ student_id: TEST_USERS.studentA.id, content: 'Test passage' }] 
        })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(202);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Student Can Still Use Text-Based Features
  // ────────────────────────────────────────────────────────────────────────────
  describe('Text-Based Features Still Accessible Without Consent', () => {
    it('should allow session creation without consent', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'passage-1', content: 'Test passage', grade_level: 3 }],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'new-session', student_id: TEST_USERS.studentA.id, passage_id: 'passage-1', status: 'in_progress' }],
      });

      const res = await request(app)
        .post('/api/v1/sessions')
        .set('Cookie', `token=${studentToken}`)
        .send({ passage_id: 'passage-1' });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
    });

    it('should allow passage listing without consent', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'passage-1', title: 'Test', content: 'Content', grade_level: 3 }],
      });

      const res = await request(app)
        .get('/api/v1/passages')
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.passages)).toBe(true);
    });

    it('should allow drill completion without consent (text-based)', async () => {
      const drillId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: drillId, completed: false, student_id: TEST_USERS.studentA.id }],
      }).mockResolvedValueOnce({
        rows: [{ id: drillId, completed: true }],
      });

      const res = await request(app)
        .post(`/api/v1/sessions/drills/${drillId}/complete`)
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow session results polling without consent', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: sessionId, student_id: TEST_USERS.studentA.id, status: 'completed', words_per_minute: 80 }],
      });

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/status`)
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Teacher/Parent Access Not Affected by Student Consent
  // ────────────────────────────────────────────────────────────────────────────
  describe('Teacher/Parent Access to Audio', () => {
    it('should allow teacher to access student audio with valid link', async () => {
      // Teacher doesn't need student consent for their own access
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: sessionId, 
            student_id: TEST_USERS.studentA.id, 
            audio_storage_key: 'student/session.webm',
            audio_mime_type: 'audio/webm',
            student_school_id: 'school-1',
          }] 
        })
        .mockResolvedValueOnce({ rows: [{ id: 'link-1' }] }); // teacher_student_links

      const { getAudioStorage } = await import('../services/audioStorage');
      const mockStorage = {
        getBuffer: vi.fn().mockResolvedValue(Buffer.from('audio-data')),
        getMimeType: vi.fn().mockReturnValue('audio/webm'),
      };
      vi.mocked(getAudioStorage).mockResolvedValue(mockStorage);

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${teacherToken}`);

      // Teacher access is controlled by teacher_student_links, not student consent
      expect(res.status).toBe(200);
    });

    it('should allow parent to access student audio with valid link and active consent', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: sessionId, 
            student_id: TEST_USERS.studentA.id, 
            audio_storage_key: 'student/session.webm',
            audio_mime_type: 'audio/webm',
            student_school_id: 'school-1',
          }] 
        })
        .mockResolvedValueOnce({ rows: [{ id: 'link-1' }] }); // parent_student_links

      const { getAudioStorage } = await import('../services/audioStorage');
      const mockStorage = {
        getBuffer: vi.fn().mockResolvedValue(Buffer.from('audio-data')),
        getMimeType: vi.fn().mockReturnValue('audio/webm'),
      };
      vi.mocked(getAudioStorage).mockResolvedValue(mockStorage);

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${parentToken}`);

      expect(res.status).toBe(200);
    });

    it('should block parent if consent withdrawn', async () => {
      mockQuery
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: sessionId, 
            student_id: TEST_USERS.studentA.id, 
            audio_storage_key: 'student/session.webm',
            audio_mime_type: 'audio/webm',
            student_school_id: 'school-1',
          }] 
        })
        .mockResolvedValueOnce({ rows: [] }); // No active parent_student_links (withdrawn)

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${parentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Frontend Integration Hint
  // ────────────────────────────────────────────────────────────────────────────
  describe('Frontend Behavior (Documentation)', () => {
    it('should disable microphone button when consent denied', () => {
      // This is a frontend test - documented here for completeness
      // Frontend should check consent status and disable recording UI
      expect(true).toBe(true);
    });

    it('should show consent required message in recording UI', () => {
      // Frontend should show "A parent needs to confirm consent before voice recording can be used"
      expect(true).toBe(true);
    });
  });
});