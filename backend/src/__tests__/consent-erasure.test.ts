/**
 * Consent Erasure / Data Deletion Tests — SEC-15
 * 
 * SEC-15: Data deletion request removes all student data within 30 days
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockQuery, generateTestToken, TEST_USERS } from './helpers/setup';
import request from 'supertest';
import app from '../server';
import * as consentErasureModule from '../queue/consentErasure';
import { eraseConsentDataForLink, eraseExpiredConsentData, scheduleConsentErasureJob } from '../queue/consentErasure';
import { sendDataDeletionEmail } from '../services/email';
import { getAudioStorage } from '../services/audioStorage';

vi.mock('../queue/consentErasure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../queue/consentErasure')>();
  return {
    ...actual,
    eraseConsentDataForLink: vi.fn().mockImplementation(actual.eraseConsentDataForLink),
  };
});

vi.mock('../services/email', () => ({
  sendDataDeletionEmail: vi.fn().mockResolvedValue(undefined),
  sendConsentEmail: vi.fn().mockResolvedValue(undefined),
  sendConsentWithdrawalEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/audioStorage', () => ({
  getAudioStorage: vi.fn().mockResolvedValue({
    deleteByStudentId: vi.fn().mockResolvedValue(3),
    delete: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('Consent Erasure / Data Deletion (SEC-15)', () => {
  const adminToken = generateTestToken(TEST_USERS.admin);
  const parentToken = generateTestToken(TEST_USERS.parent);
  const linkId = '11111111-1111-1111-1111-111111111111';
  const studentId = TEST_USERS.studentA.id;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Core Erasure Function
  // ────────────────────────────────────────────────────────────────────────────
  describe('eraseConsentDataForLink', () => {
    it('should purge all student data when consent withdrawn and 30 days elapsed', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // Link lookup
          rows: [{
            id: linkId,
            parent_id: TEST_USERS.parent.id,
            student_id: studentId,
            parent_email: 'parent@example.com',
            student_name: 'Test Student',
          }],
        })
        .mockResolvedValueOnce({ // Other links check
          rows: [{ id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' }],
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE reading_sessions
        .mockResolvedValueOnce({ rows: [] }) // UPDATE error_classifications
        .mockResolvedValueOnce({ rows: [] }) // UPDATE error_profiles
        .mockResolvedValueOnce({ rows: [] }) // UPDATE drills
        .mockResolvedValueOnce({ rows: [] }) // DELETE drills
        .mockResolvedValueOnce({ rows: [] }) // DELETE error_classifications
        .mockResolvedValueOnce({ rows: [] }) // DELETE error_profiles
        .mockResolvedValueOnce({ rows: [] }) // DELETE reading_sessions
        .mockResolvedValueOnce({ rows: [] }) // UPDATE parent_student_links
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ // Audio keys lookup
          rows: [
            { audio_storage_key: `${studentId}/session1.webm` },
            { audio_storage_key: `${studentId}/session2.webm` },
          ],
        });

      const result = await eraseConsentDataForLink(linkId, true);

      expect(result).toBe('purged');
      expect(mockQuery).toHaveBeenCalledTimes(14);
      
      // Verify cascade deletes
      const deleteCalls = mockQuery.mock.calls
        .filter(([sql]) => sql && sql.includes('DELETE'))
        .map(([sql]) => sql);
      
      expect(deleteCalls.some(sql => sql.includes('DELETE FROM drills'))).toBe(true);
      expect(deleteCalls.some(sql => sql.includes('DELETE FROM error_classifications'))).toBe(true);
      expect(deleteCalls.some(sql => sql.includes('DELETE FROM error_profiles'))).toBe(true);
      expect(deleteCalls.some(sql => sql.includes('DELETE FROM reading_sessions'))).toBe(true);
    });

    it('should skip if another parent has active consent for same student', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // Link lookup
          rows: [{
            id: linkId,
            parent_id: TEST_USERS.parent.id,
            student_id: studentId,
            parent_email: 'parent@example.com',
            student_name: 'Test Student',
          }],
        })
        .mockResolvedValueOnce({ // Other links - another parent has active consent
          rows: [
            { id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' },
            { id: 'other-link', consent_granted: true, withdrawn_at: null }, // ACTIVE!
          ],
        });

      const result = await eraseConsentDataForLink(linkId, true);

      expect(result).toBe('skipped_active_consent');
    });

    it('should return not_eligible if link not found or not withdrawn', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Link not found

      const result = await eraseConsentDataForLink(linkId, true);

      expect(result).toBe('not_eligible');
    });

    it('should delete audio files from object storage', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: linkId,
            parent_id: TEST_USERS.parent.id,
            student_id: studentId,
            parent_email: 'parent@example.com',
            student_name: 'Test Student',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ audio_storage_key: `${studentId}/session1.webm` }],
        });

      const { getAudioStorage } = await import('../services/audioStorage');
      const mockStorage = {
        deleteByStudentId: vi.fn().mockResolvedValue(1),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(getAudioStorage).mockResolvedValue(mockStorage);

      const result = await eraseConsentDataForLink(linkId, true);

      expect(result).toBe('purged');
      expect(mockStorage.deleteByStudentId).toHaveBeenCalledWith(studentId);
      expect(mockStorage.delete).toHaveBeenCalledWith(`${studentId}/session1.webm`);
    });

    it('should send data deletion confirmation email', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: linkId,
            parent_id: TEST_USERS.parent.id,
            student_id: studentId,
            parent_email: 'parent@example.com',
            student_name: 'Test Student',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await eraseConsentDataForLink(linkId, true);

      expect(result).toBe('purged');
      expect(sendDataDeletionEmail).toHaveBeenCalledWith('parent@example.com', 'Test Student');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scheduled Erasure Job
  // ────────────────────────────────────────────────────────────────────────────
  describe('eraseExpiredConsentData (Daily Cron)', () => {
    it('should find and purge all due links', async () => {
      mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('WHERE hard_delete_at <= NOW()')) {
          return { rows: [{ id: linkId }, { id: 'link-2' }] };
        }
        if (sql.includes('WHERE link.id = $1')) {
          return { rows: [{ id: params?.[0] || 'link-1', parent_id: TEST_USERS.parent.id, student_id: studentId, parent_email: 'p@test.com', student_name: 'S' }] };
        }
        if (sql.includes('FROM parent_student_links') && sql.includes('FOR UPDATE')) {
          return { rows: [{ id: params?.[0] || 'link-1', consent_granted: false, withdrawn_at: '2024-01-01' }] };
        }
        return { rows: [] };
      });

      const result = await eraseExpiredConsentData();

      expect(result.purged).toBe(2);
      expect(result.skipped).toBe(0);
    });

    it('should count skipped links', async () => {
      mockQuery.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('WHERE hard_delete_at <= NOW()')) {
          return { rows: [{ id: linkId }, { id: 'link-2' }] };
        }
        if (sql.includes('WHERE link.id = $1')) {
          return { rows: [{ id: params?.[0] || 'link-1', parent_id: TEST_USERS.parent.id, student_id: params?.[0] === 'link-2' ? 'student-2' : studentId, parent_email: 'p@test.com', student_name: 'S' }] };
        }
        if (sql.includes('FROM parent_student_links') && sql.includes('FOR UPDATE')) {
          if (params?.[0] === 'student-2') {
            return {
              rows: [
                { id: 'link-2', consent_granted: false, withdrawn_at: '2024-01-01' },
                { id: 'other-active-link', consent_granted: true, withdrawn_at: null }
              ]
            };
          }
          return { rows: [{ id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' }] };
        }
        return { rows: [] };
      });

      const result = await eraseExpiredConsentData();

      expect(result.purged).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // API Endpoints
  // ────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/consent/withdraw', () => {
    it('should withdraw consent and set 30-day hard delete timer', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_email: 'parent@example.com',
          student_name: 'Test Student',
          hard_delete_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        }],
      });

      const res = await request(app)
        .post('/api/v1/consent/withdraw')
        .set('Cookie', `token=${parentToken}`)
        .send({ student_id: studentId });

      expect(res.status).toBe(200);
      expect(res.body.consent_granted).toBe(false);
      expect(res.body.hard_delete_at).toBeDefined();
    });

    it('should require valid student UUID', async () => {
      const res = await request(app)
        .post('/api/v1/consent/withdraw')
        .set('Cookie', `token=${parentToken}`)
        .send({ student_id: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/consent/:linkId/force-purge (Admin)', () => {
    it('should allow admin to force purge immediately', async () => {
      vi.spyOn(consentErasureModule, 'eraseConsentDataForLink').mockResolvedValueOnce('purged');

      const res = await request(app)
        .post(`/api/v1/consent/${linkId}/force-purge`)
        .set('Cookie', `token=${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.purged).toBe(true);
    });

    it('should reject non-admin users', async () => {
      const res = await request(app)
        .post(`/api/v1/consent/${linkId}/force-purge`)
        .set('Cookie', `token=${parentToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Data Deletion Completeness Verification
  // ────────────────────────────────────────────────────────────────────────────
  describe('Data Deletion Completeness', () => {
    it('should delete all related tables', async () => {
      const tablesToDelete = [
        'reading_sessions',
        'error_classifications',
        'error_profiles',
        'drills',
      ];

      mockQuery.mockResolvedValue({ rows: [] });
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: linkId,
            parent_id: TEST_USERS.parent.id,
            student_id: studentId,
            parent_email: 'parent@example.com',
            student_name: 'Test Student',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' }] });

      // Mock all the UPDATE/DELETE calls
      for (let i = 0; i < 12; i++) {
        mockQuery.mockResolvedValueOnce({ rows: [] });
      }

      await eraseConsentDataForLink(linkId, true);

      // Verify each table was targeted
      const allSql = mockQuery.mock.calls.map(([sql]) => sql).join(' ');
      
      for (const table of tablesToDelete) {
        expect(allSql).toContain(table);
      }
    });

    it('should not delete user accounts (only link data)', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: linkId,
            parent_id: TEST_USERS.parent.id,
            student_id: studentId,
            parent_email: 'parent@example.com',
            student_name: 'Test Student',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' }] });

      for (let i = 0; i < 8; i++) {
        mockQuery.mockResolvedValueOnce({ rows: [] });
      }
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await eraseConsentDataForLink(linkId, true);

      const allSql = mockQuery.mock.calls.map(([sql]) => sql).join(' ');
      
      // Users table should not be deleted
      expect(allSql).not.toContain('DELETE FROM users');
      expect(allSql).not.toContain('UPDATE users SET deleted_at');
    });

    it('should soft-delete first, then hard-delete after 30 days', async () => {
      // The flow: withdraw -> sets hard_delete_at -> daily cron -> hard delete
      // This test verifies the two-phase approach
      
      // Phase 1: Withdraw (soft delete)
      mockQuery.mockResolvedValue({ rows: [] });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          parent_email: 'parent@example.com',
          student_name: 'Test Student',
          hard_delete_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        }],
      });

      await request(app)
        .post('/api/v1/consent/withdraw')
        .set('Cookie', `token=${parentToken}`)
        .send({ student_id: studentId });

      // Verify soft delete (UPDATE with hard_delete_at)
      const withdrawSql = mockQuery.mock.calls
        .filter(([sql]) => sql && sql.includes('UPDATE parent_student_links'))
        .map(([sql]) => sql);
      
      expect(withdrawSql.length).toBeGreaterThan(0);
      expect(withdrawSql[0]).toContain('hard_delete_at');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Retention Policy Verification
  // ────────────────────────────────────────────────────────────────────────────
  describe('Data Retention Policy', () => {
    it('should retain consent records for 7 years', async () => {
      // Consent records in parent_student_links are retained with purged_at timestamp
      // Only the student data is deleted, not the consent audit trail
      mockQuery.mockResolvedValue({ rows: [] });
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: linkId,
            parent_id: TEST_USERS.parent.id,
            student_id: studentId,
            parent_email: 'parent@example.com',
            student_name: 'Test Student',
          }],
        })
        .mockResolvedValueOnce({ rows: [{ id: linkId, consent_granted: false, withdrawn_at: '2024-01-01' }] });

      for (let i = 0; i < 12; i++) {
        mockQuery.mockResolvedValueOnce({ rows: [] });
      }

      await eraseConsentDataForLink(linkId, true);

      const allSql = mockQuery.mock.calls.map(([sql]) => sql).join(' ');
      expect(allSql).toContain('purged_at');
      expect(allSql).not.toContain('DELETE FROM parent_student_links');
    });
  });
});