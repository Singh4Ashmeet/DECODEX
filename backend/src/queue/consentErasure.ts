import { consentErasureQueue } from './index';
import { pool, query } from '../db';
import { sendDataDeletionEmail } from '../services/email';
import { getAudioStorage } from '../services/audioStorage';

export type ConsentErasureResult = 'purged' | 'skipped_active_consent' | 'not_eligible';

interface ErasureLink {
  id: string;
  parent_id: string;
  student_id: string;
  parent_email: string;
  student_name: string;
}

export const scheduleConsentErasureJob = async (): Promise<void> => {
  await consentErasureQueue.add(
    {},
    {
      jobId: 'daily-consent-erasure',
      repeat: { cron: '0 3 * * *' },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
};

export const eraseExpiredConsentData = async (): Promise<{ purged: number; skipped: number }> => {
  const dueLinks = await query(
    [
      'SELECT id',
      'FROM parent_student_links',
      'WHERE hard_delete_at <= NOW()',
      'AND withdrawn_at IS NOT NULL',
      'AND purged_at IS NULL',
    ].join('\n')
  );

  let purged = 0;
  let skipped = 0;

  for (const dueLink of dueLinks.rows as Array<{ id: string }>) {
    const result = await eraseConsentDataForLink(dueLink.id);
    if (result === 'purged') {
      purged += 1;
    } else if (result === 'skipped_active_consent') {
      skipped += 1;
    }
  }

  return { purged, skipped };
};

export const eraseConsentDataForLink = async (linkId: string, bypassSchedule = false): Promise<ConsentErasureResult> => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const linkResult = await client.query(
      [
        'SELECT link.id, link.parent_id, link.student_id, parent.email AS parent_email, student.display_name AS student_name',
        'FROM parent_student_links link',
        'JOIN users parent ON parent.id = link.parent_id',
        'JOIN users student ON student.id = link.student_id',
        'WHERE link.id = $1',
        'AND link.withdrawn_at IS NOT NULL',
        'AND link.purged_at IS NULL',
        'AND ($2::boolean OR link.hard_delete_at <= NOW())',
        'FOR UPDATE OF link',
      ].join('\n'),
      [linkId, bypassSchedule]
    );
    const link = linkResult.rows[0] as ErasureLink | undefined;

    if (!link) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return 'not_eligible';
    }

    const studentLinksResult = await client.query(
      [
        'SELECT id, consent_granted, withdrawn_at',
        'FROM parent_student_links',
        'WHERE student_id = $1',
        'FOR UPDATE',
      ].join('\n'),
      [link.student_id]
    );

    const hasOtherActiveConsent = studentLinksResult.rows.some((studentLink: {
      id: string;
      consent_granted: boolean;
      withdrawn_at: string | Date | null;
    }) => (
      studentLink.id !== link.id
      && studentLink.consent_granted
      && studentLink.withdrawn_at === null
    ));

    if (hasOtherActiveConsent) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return 'skipped_active_consent';
    }

    await client.query(
      'UPDATE reading_sessions SET deleted_at = NOW() WHERE student_id = $1',
      [link.student_id]
    );
    await client.query(
      [
        'UPDATE error_classifications SET deleted_at = NOW()',
        'WHERE session_id IN (SELECT id FROM reading_sessions WHERE student_id = $1)',
      ].join('\n'),
      [link.student_id]
    );
    await client.query(
      'UPDATE error_profiles SET deleted_at = NOW() WHERE student_id = $1',
      [link.student_id]
    );
    await client.query(
      'UPDATE drills SET deleted_at = NOW() WHERE student_id = $1',
      [link.student_id]
    );

    await client.query('DELETE FROM drills WHERE student_id = $1', [link.student_id]);
    await client.query(
      [
        'DELETE FROM error_classifications',
        'WHERE session_id IN (SELECT id FROM reading_sessions WHERE student_id = $1)',
      ].join('\n'),
      [link.student_id]
    );
    await client.query('DELETE FROM error_profiles WHERE student_id = $1', [link.student_id]);
    await client.query('DELETE FROM reading_sessions WHERE student_id = $1', [link.student_id]);
    await client.query(
      'UPDATE parent_student_links SET purged_at = NOW() WHERE id = $1',
      [link.id]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    // Delete audio files from object storage (best-effort, non-blocking)
    try {
      const storage = await getAudioStorage();
      const deletedCount = await storage.deleteByStudentId(link.student_id);
      if (deletedCount > 0) {
        console.log(`[ConsentErasure] Deleted ${deletedCount} audio files from object storage for student ${link.student_id}`);
      }
      // Also explicitly delete any remaining keys from reading_sessions (in case some weren't in student folder)
      const keyRes = await query(
        `SELECT audio_storage_key FROM reading_sessions WHERE student_id = $1 AND audio_storage_key IS NOT NULL`,
        [link.student_id]
      );
      for (const row of keyRes.rows) {
        try {
          await storage.delete(row.audio_storage_key);
        } catch (keyErr) {
          console.warn(`[ConsentErasure] Failed to delete audio key ${row.audio_storage_key}:`, keyErr);
        }
      }
    } catch (storageErr) {
      console.warn('[ConsentErasure] Object storage cleanup failed (non-fatal):', storageErr);
    }

    await sendDataDeletionEmail(link.parent_email, link.student_name);
    return 'purged';
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    console.error('Failed to erase consent-related student data.');
    throw error;
  } finally {
    client.release();
  }
};
