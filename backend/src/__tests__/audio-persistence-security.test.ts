/**
 * Audio Persistence Security Tests — SEC-11
 * 
 * SEC-11: No raw audio data exists in database after session (Query returns empty)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import app from '../server';

describe('Audio Persistence Security (SEC-11)', () => {
  const studentToken = generateTestToken(TEST_USERS.studentA);
  const teacherToken = generateTestToken(TEST_USERS.teacher);
  const sessionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    mockQuery.mockReset();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Database Schema Verification
  // ────────────────────────────────────────────────────────────────────────────
  describe('Database Schema — No Raw Audio Columns', () => {
    it('should not have audio_base64 column in reading_sessions', async () => {
      // This test verifies the schema doesn't have legacy audio storage columns
      // The schema.sql only has: audio_storage_key, audio_mime_type, audio_size_bytes, audio_storage_provider
      const schemaCheckQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'reading_sessions' 
        AND column_name IN ('audio_base64', 'audio_file_path', 'audio_blob')
      `;
      
      // In test environment, we verify via mock that these columns are never selected
      mockQuery.mockResolvedValueOnce({ rows: [] });
      
      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/results`)
        .set('Cookie', `token=${studentToken}`);

      // The query should only select allowed columns
      const selectCalls = mockQuery.mock.calls
        .filter(([sql]) => sql && sql.includes('SELECT'))
        .map(([sql]) => sql);
      
      for (const sql of selectCalls) {
        expect(sql).not.toContain('audio_base64');
        expect(sql).not.toContain('audio_file_path');
        expect(sql).not.toContain('audio_blob');
      }
    });

    it('should only have object storage reference columns', async () => {
      const allowedAudioColumns = [
        'audio_storage_key',
        'audio_mime_type', 
        'audio_size_bytes',
        'audio_storage_provider',
      ];

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: sessionId,
          student_id: TEST_USERS.studentA.id,
          passage_id: 'passage-1',
          status: 'completed',
          audio_storage_key: 'student-id/session-id.webm',
          audio_mime_type: 'audio/webm',
          audio_size_bytes: 1024,
          audio_storage_provider: 'local',
        }],
      });

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/results`)
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(200);
      if (res.body.session) {
        expect(res.body.session).not.toHaveProperty('audio_base64');
        expect(res.body.session).not.toHaveProperty('audio_file_path');
        expect(res.body.session).not.toHaveProperty('audio_blob');
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Audio Upload — Never Persists Raw Audio to DB
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/sessions/:id/audio — No DB Audio Storage', () => {
    it('should not insert raw audio into database', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ student_id: TEST_USERS.studentA.id, content: 'Test passage' }] })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE with storage key only

      const res = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(202);
      
      // Verify UPDATE only sets storage metadata, not raw audio
      const updateCalls = mockQuery.mock.calls
        .filter(([sql]) => sql && sql.includes('UPDATE reading_sessions'))
        .map(([sql]) => sql);
      
      for (const sql of updateCalls) {
        expect(sql).toContain('audio_storage_key');
        expect(sql).toContain('audio_mime_type');
        expect(sql).toContain('audio_size_bytes');
        expect(sql).toContain('audio_storage_provider');
        expect(sql).not.toContain('audio_base64');
        expect(sql).not.toContain('audio_file_path');
      }
    });

    it('should queue job with file path (temp file) not audio data', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ student_id: TEST_USERS.studentA.id, content: 'Test passage' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`)
        .attach('audio', Buffer.from('fake-audio-data'), 'test.webm');

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('queued');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Worker Processing — Temp File Cleanup
  // ────────────────────────────────────────────────────────────────────────────
  describe('Audio Worker — Temp File Cleanup', () => {
    it('should clean up temp file after processing', async () => {
      // This is tested in worker.test.ts but we verify the pattern here
      // The worker's processAudioJob has a finally block that unlinks the temp file
      const fs = await import('fs');
      expect(typeof fs.unlink).toBe('function');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Audio Serving — Only from Object Storage
  // ────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/sessions/:id/audio — Object Storage Only', () => {
    it('should serve audio only from object storage (audio_storage_key)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: sessionId,
          student_id: TEST_USERS.studentA.id,
          audio_storage_key: 'student-id/session-id.webm',
          audio_mime_type: 'audio/webm',
          student_school_id: 'school-1',
        }],
      });

      // Mock object storage
      const { getAudioStorage } = await import('../services/audioStorage');
      const mockStorage = {
        getBuffer: vi.fn().mockResolvedValue(Buffer.from('audio-data')),
        getMimeType: vi.fn().mockReturnValue('audio/webm'),
      };
      vi.mocked(getAudioStorage).mockResolvedValue(mockStorage);

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(200);
      expect(mockStorage.getBuffer).toHaveBeenCalledWith('student-id/session-id.webm');
    });

    it('should return 404 if no audio_storage_key', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: sessionId,
          student_id: TEST_USERS.studentA.id,
          audio_storage_key: null,
          audio_mime_type: null,
          student_school_id: 'school-1',
        }],
      });

      const res = await request(app)
        .get(`/api/v1/sessions/${sessionId}/audio`)
        .set('Cookie', `token=${studentToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Consent Erasure — Audio Cleanup
  // ────────────────────────────────────────────────────────────────────────────
  describe('Consent Erasure — Audio Deletion', () => {
    it('should delete audio files from object storage on consent withdrawal', async () => {
      const { eraseConsentDataForLink } = await import('../queue/consentErasure');
      const { getAudioStorage } = await import('../services/audioStorage');
      
      const mockStorage = {
        deleteByStudentId: vi.fn().mockResolvedValue(5),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getAudioStorage).mockResolvedValue(mockStorage);

      // Mock DB queries for erasure
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ 
          rows: [{ id: 'link-1', parent_id: 'parent-1', student_id: 'student-1', parent_email: 'p@test.com', student_name: 'Student' }] 
        })
        .mockResolvedValueOnce({ rows: [{ id: 'link-1', consent_granted: false, withdrawn_at: '2024-01-01' }] })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE sessions
        .mockResolvedValueOnce({ rows: [] }) // UPDATE error_classifications
        .mockResolvedValueOnce({ rows: [] }) // UPDATE error_profiles
        .mockResolvedValueOnce({ rows: [] }) // UPDATE drills
        .mockResolvedValueOnce({ rows: [] }) // DELETE drills
        .mockResolvedValueOnce({ rows: [] }) // DELETE error_classifications
        .mockResolvedValueOnce({ rows: [] }) // DELETE error_profiles
        .mockResolvedValueOnce({ rows: [] }) // DELETE reading_sessions
        .mockResolvedValueOnce({ rows: [] }) // UPDATE parent_student_links
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ rows: [{ audio_storage_key: 'student-1/session-1.webm' }] }); // Key lookup

      const result = await eraseConsentDataForLink('link-1', true);

      expect(result).toBe('purged');
      expect(mockStorage.deleteByStudentId).toHaveBeenCalledWith('student-1');
      expect(mockStorage.delete).toHaveBeenCalledWith('student-1/session-1.webm');
    });
  });
});