import fs from 'fs';
import * as Sentry from '@sentry/node';
import { audioQueue, AudioJobData, consentErasureQueue } from './index';
import { eraseExpiredConsentData, scheduleConsentErasureJob } from './consentErasure';
import { transcribeAudio } from '../services/openai';
import { alignText } from '../services/alignment';
import { classifyErrors } from '../services/classifier';
import { saveClassifications, updateErrorProfile } from '../db/analytics';
import { generateDrill } from '../services/drills';
import { query } from '../db';
import { getSSEClient } from '../routes/sessions';
import { logger } from '../lib/logger';

/**
 * Core audio processing pipeline — extracted so it can be called by both the
 * Bull queue worker AND the in-process fallback when Redis is unavailable.
 */
export async function processAudioJob(data: AudioJobData): Promise<{ success: boolean; wpm: number }> {
  const { sessionId, passageText, filePath } = data;
  const sseClient = getSSEClient(sessionId);

  // Record wall-clock start time to compute duration_seconds accurately.
  const processingStart = Date.now();

  try {
    // Fetch student's preferred_language for STT (must be before transcription)
    const sessionRes = await query('SELECT student_id, started_at FROM reading_sessions WHERE id = $1', [sessionId]);
    const studentId = sessionRes.rows[0].student_id;
    const startedAt: Date = sessionRes.rows[0].started_at;

    const studentLangRes = await query('SELECT preferred_language FROM users WHERE id = $1', [studentId]);
    const studentPreferredLanguage = studentLangRes.rows[0]?.preferred_language || 'en';

    // 1. Transcribe (STT) with student's preferred language
    sseClient?.sendEvent('status', { step: 'transcribing', message: 'Converting speech to text...' });
    const transcript = await transcribeAudio(filePath, passageText, studentPreferredLanguage);

    // 2. Align
    sseClient?.sendEvent('status', { step: 'aligning', message: 'Aligning with original text...' });
    const alignmentResult = alignText(passageText, transcript);

    // 3. Classify Errors (LLM + Cache)
    sseClient?.sendEvent('status', { step: 'classifying', message: 'Analyzing errors with AI...' });
    const classifications = await classifyErrors(alignmentResult);

    // 4. DB Aggregation & Persistence
    sseClient?.sendEvent('status', { step: 'saving', message: 'Saving results...' });

    // Compute WPM: total matched/substituted words / (duration in minutes).
    // Use the session's started_at for elapsed time, falling back to job processing time.
    const completedAt = new Date();
    const durationMs = startedAt
      ? completedAt.getTime() - new Date(startedAt).getTime()
      : Date.now() - processingStart;
    const durationSeconds = Math.max(1, Math.round(durationMs / 1000));

    // Count total words in the original passage as the denominator for WPM.
    const totalPassageWords = passageText.trim().split(/\s+/).filter(w => w.length > 0).length;
    const wordsPerMinute = parseFloat((totalPassageWords / (durationSeconds / 60)).toFixed(1));

    await saveClassifications(sessionId, classifications);
    const errorCounts = await updateErrorProfile(sessionId, studentId, alignmentResult, classifications);

    // 5. Generate Drills
    sseClient?.sendEvent('status', { step: 'generating', message: 'Generating personalized drills...' });
    await generateDrill(sessionId, studentId, errorCounts);

    // 6. Persist session completion with real WPM and duration
    await query(
      `UPDATE reading_sessions 
       SET transcript = $1,
           alignment_result = $2,
           status = 'completed',
           completed_at = $3,
           duration_seconds = $4,
           words_per_minute = $5
       WHERE id = $6`,
      [transcript, JSON.stringify(alignmentResult), completedAt, durationSeconds, wordsPerMinute, sessionId]
    );

    // 7. Compute Health Score (V2 — AI Intervention Platform)
    sseClient?.sendEvent('status', { step: 'scoring', message: 'Computing Reading Health Score...' });
    try {
      const { computeHealthScore } = await import('../services/healthScore');
      await computeHealthScore(sessionId, studentId);
    } catch (hsError) {
      logger.error({ err: hsError }, 'Health score computation failed (non-fatal)');
    }

    // 8. Finalize any linked teacher assignment after its health score is available.
    try {
      const { completeAssignmentForSession } = await import('../services/assignments');
      await completeAssignmentForSession(sessionId);
    } catch (assignmentError) {
      logger.error({ err: assignmentError }, 'Assignment completion update failed (non-fatal)');
    }

    // 9. Update Gamification (V2 — XP, streaks, achievements)
    try {
      const { recordSessionCompletion } = await import('../services/gamification');
      await recordSessionCompletion(studentId);
    } catch (gamError) {
      logger.error({ err: gamError }, 'Gamification update failed (non-fatal)');
    }

    // 10. Complete
    sseClient?.sendEvent('status', { step: 'complete', message: 'Processing complete!', wpm: wordsPerMinute });
    
    return { success: true, wpm: wordsPerMinute };
} catch (error: any) {
    logger.error({ sessionId, err: error }, 'Audio processing job failed');
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error, { extra: { sessionId } });
    }

    await query(
      `UPDATE reading_sessions SET status = 'error' WHERE id = $1`,
      [sessionId]
    );
    sseClient?.sendEvent('error', { message: error.message || 'Processing failed' });
    throw error;
  } finally {
    // Always clean up the temp audio file to prevent unbounded disk growth.
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) logger.error({ filePath, err }, 'Failed to delete temp file');
        else logger.info({ filePath }, 'Cleaned up temp file');
      });
    }
  }
}

// Bull queue worker delegates to the shared processAudioJob function — skip queue processing in test env
if (process.env.NODE_ENV !== 'test') {
  audioQueue.process(async (job) => {
    return processAudioJob(job.data as AudioJobData);
  });

  consentErasureQueue.process(async () => {
    return eraseExpiredConsentData();
  });

  scheduleConsentErasureJob().catch(() => {
    logger.error('Failed to schedule the daily consent erasure job.');
  });

  logger.info('Audio processing worker started.');
}
