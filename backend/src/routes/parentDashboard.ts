import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getLatestHealthScore, getHealthScoreHistory } from '../services/healthScore';
import { getLatestScreening } from '../services/riskScreening';
import { generateStrategy } from '../services/copilot';
import { synthesizeSpeech } from '../services/tts';
import { getAudioStorage } from '../services/audioStorage';

const router = Router();

const requireParent = requireRole(['parent', 'admin']);

// GET /api/v1/parent/children/:studentId/progress
// Get a child's progress overview (health score, trends, risk indicators).
router.get('/children/:studentId/progress', authenticate, requireParent, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const parentId = req.user?.id;

  try {
    // Verify parent-student link
    if (req.user?.role === 'parent') {
      const linkRes = await query(
        `SELECT 1 FROM parent_student_links
         WHERE parent_id = $1 AND student_id = $2 AND withdrawn_at IS NULL`,
        [parentId, studentId]
      );
      if (linkRes.rows.length === 0) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No linked child found' } });
      }
    }

    // Get student info
    const studentRes = await query(
      `SELECT id, display_name, grade_level FROM users WHERE id = $1`,
      [studentId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student not found' } });
    }

    // Get health score
    const healthScore = await getLatestHealthScore(studentId);
    const healthHistory = await getHealthScoreHistory(studentId, 10);

    // Get risk screening
    const screening = await getLatestScreening(studentId);

    // Get recent sessions
    const sessionsRes = await query(
      `SELECT rs.id, rs.started_at, rs.words_per_minute, rs.duration_seconds,
              ep.error_rate, ep.total_words_read, ep.total_errors,
              p.title as passage_title
       FROM reading_sessions rs
       LEFT JOIN error_profiles ep ON ep.session_id = rs.id
       LEFT JOIN passages p ON rs.passage_id = p.id
       WHERE rs.student_id = $1 AND rs.status = 'completed' AND rs.deleted_at IS NULL
       ORDER BY rs.started_at DESC LIMIT 10`,
      [studentId]
    );

    // Compute strength areas
    const strengthAreas: string[] = [];
    if (healthScore) {
      if (healthScore.accuracy >= 80) strengthAreas.push('Strong reading accuracy');
      if (healthScore.fluency >= 80) strengthAreas.push('Good reading fluency');
      if (healthScore.wpmNormalized >= 80) strengthAreas.push('Above-average reading speed');
      if (healthScore.improvementTrend >= 60) strengthAreas.push('Positive improvement trend');
    }
    if (strengthAreas.length === 0) strengthAreas.push('Building foundational skills');

    // Compute recommendations
    const recommendations: string[] = [];
    if (healthScore && healthScore.score < 60) {
      recommendations.push('Consider daily 10-minute reading practice');
      recommendations.push('Use the Decodex practice drills after each session');
    }
    if (screening && screening.risk !== 'low') {
      recommendations.push('Discuss screening results with the classroom teacher');
    }
    recommendations.push('Celebrate reading milestones together');
    recommendations.push('Listen to your child read aloud for 15 minutes daily');

    res.json({
      student: studentRes.rows[0],
      healthScore,
      healthHistory,
      screening,
      recentSessions: sessionsRes.rows,
      strengthAreas,
      recommendations,
    });
  } catch (error) {
    console.error('Error fetching child progress:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch progress' } });
  }
});

// GET /api/v1/parent/children
// Get all linked children with summary data.
router.get('/children', authenticate, requireParent, async (req: AuthRequest, res) => {
  const parentId = req.user?.id;

  try {
    const childrenRes = await query(
      `SELECT u.id, u.display_name, u.grade_level,
              psl.consent_granted, psl.consent_date,
              (SELECT COUNT(*) FROM reading_sessions rs WHERE rs.student_id = u.id AND rs.status = 'completed') as session_count,
              (SELECT hs.score FROM health_scores hs WHERE hs.student_id = u.id ORDER BY hs.computed_at DESC LIMIT 1) as health_score,
              (SELECT rs2.words_per_minute FROM reading_sessions rs2 WHERE rs2.student_id = u.id AND rs2.status = 'completed' ORDER BY rs2.started_at DESC LIMIT 1) as latest_wpm
       FROM parent_student_links psl
       JOIN users u ON u.id = psl.student_id
       WHERE psl.parent_id = $1 AND psl.withdrawn_at IS NULL AND u.deleted_at IS NULL`,
      [parentId]
    );

    res.json({ children: childrenRes.rows });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch children' } });
  }
});

// GET /api/v1/parent/children/:studentId/sessions/:sessionId/report
// Full session diagnostic report for parent portal (matching student/teacher dashboard session results).
router.get('/children/:studentId/sessions/:sessionId/report', authenticate, requireParent, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const sessionId = String(req.params.sessionId);
  const parentId = req.user?.id;

  try {
    // Verify parent-student link
    if (req.user?.role === 'parent') {
      const linkRes = await query(
        `SELECT 1 FROM parent_student_links
         WHERE parent_id = $1 AND student_id = $2 AND withdrawn_at IS NULL`,
        [parentId, studentId]
      );
      if (linkRes.rows.length === 0) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No linked child found' } });
      }
    }

    // 1. Session & Passage
    const sessionRes = await query(
      `SELECT rs.id, rs.started_at, rs.completed_at, rs.duration_seconds,
              rs.words_per_minute, rs.transcript, rs.alignment_result,
              rs.audio_storage_key, rs.audio_mime_type, rs.audio_size_bytes, rs.audio_storage_provider,
              p.id as passage_id, p.title as passage_title, p.content as passage_content,
              p.grade_level, p.word_count
       FROM reading_sessions rs
       JOIN passages p ON rs.passage_id = p.id
       WHERE rs.id = $1 AND rs.student_id = $2 AND rs.deleted_at IS NULL`,
      [sessionId, studentId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const session = sessionRes.rows[0];

    // 2. Error Profile
    const profileRes = await query(
      `SELECT * FROM error_profiles WHERE session_id = $1 AND deleted_at IS NULL`,
      [sessionId]
    );

    // 3. Classifications
    const classRes = await query(
      `SELECT word_index, source_word, spoken_word, category, rationale, confidence_flag
       FROM error_classifications WHERE session_id = $1 AND deleted_at IS NULL
       ORDER BY word_index ASC`,
      [sessionId]
    );

    // 4. Drills
    const drillsRes = await query(
      `SELECT id, target_category, drill_type, content, completed
       FROM drills WHERE session_id = $1 AND deleted_at IS NULL`,
      [sessionId]
    );

    // 5. Improvement plan via copilot
    let improvementPlan = null;
    try {
      const strategy = await generateStrategy(studentId);
      improvementPlan = {
        summary: strategy.summary,
        keyConcerns: strategy.keyConcerns,
        weeklyRoadmap: strategy.weeklyRoadmap,
        parentCommunicationDraft: strategy.parentCommunicationDraft,
        healthScoreAtGeneration: strategy.healthScoreAtGeneration,
        riskLevelAtGeneration: strategy.riskLevelAtGeneration,
      };
    } catch (planErr) {
      console.warn('Copilot strategy generation failed for parent report:', planErr);
    }

    // Check object storage (audio_base64 and audio_file_path columns dropped in V6)
    let hasStudentRecording = false;
    if (session.audio_storage_key) {
      try {
        const storage = await getAudioStorage();
        hasStudentRecording = await storage.exists(session.audio_storage_key);
      } catch (storageErr) {
        console.warn('Object storage check failed:', storageErr);
      }
    }

    res.json({
      session,
      passage: {
        id: session.passage_id,
        title: session.passage_title,
        content: session.passage_content,
        grade_level: session.grade_level,
        word_count: session.word_count,
      },
      errorProfile: profileRes.rows[0] || null,
      alignment: session.alignment_result || [],
      classifications: classRes.rows,
      drills: drillsRes.rows,
      improvementPlan,
      hasStudentRecording,
    });
  } catch (error) {
    console.error('Error fetching parent session report:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch session report' } });
  }
});

// GET /api/v1/parent/children/:studentId/sessions/:sessionId/student-audio
// Streams the student's actual recorded reading audio file for parental review.
router.get('/children/:studentId/sessions/:sessionId/student-audio', authenticate, requireParent, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const sessionId = String(req.params.sessionId);
  const parentId = req.user?.id;

  try {
    if (req.user?.role === 'parent') {
      const linkRes = await query(
        `SELECT 1 FROM parent_student_links
         WHERE parent_id = $1 AND student_id = $2 AND withdrawn_at IS NULL`,
        [parentId, studentId]
      );
      if (linkRes.rows.length === 0) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No linked child found' } });
      }
    }

    const sessionRes = await query(
      `SELECT audio_storage_key, audio_mime_type, transcript FROM reading_sessions
       WHERE id = $1 AND student_id = $2 AND deleted_at IS NULL`,
      [sessionId, studentId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const { audio_storage_key, audio_mime_type, transcript } = sessionRes.rows[0];

    // Try object storage only (audio_base64 and audio_file_path columns dropped in V6)
    if (audio_storage_key) {
      try {
        const storage = await getAudioStorage();
        const buffer = await storage.getBuffer(audio_storage_key);
        if (buffer) {
          const mimeType = audio_mime_type || storage.getMimeType(audio_storage_key);
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'private, max-age=3600');
          return res.send(buffer);
        }
      } catch (storageErr) {
        console.warn('Object storage read failed:', storageErr);
      }
    }

    // Fallback to TTS synthesis if no physical recording file exists
    if (transcript && transcript.trim()) {
      const result = await synthesizeSpeech(transcript);
      if (Buffer.isBuffer(result)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        return res.send(result);
      }
      return res.json({ useBrowserTts: true, transcript });
    }

    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No audio recording found' } });
  } catch (error) {
    console.error('Error serving student session audio:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch session audio' } });
  }
});

// GET /api/v1/parent/children/:studentId/sessions/:sessionId/tts-playback
// Legacy TTS fallback endpoint.
router.get('/children/:studentId/sessions/:sessionId/tts-playback', authenticate, requireParent, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const sessionId = String(req.params.sessionId);
  const parentId = req.user?.id;

  try {
    if (req.user?.role === 'parent') {
      const linkRes = await query(
        `SELECT 1 FROM parent_student_links
         WHERE parent_id = $1 AND student_id = $2 AND withdrawn_at IS NULL`,
        [parentId, studentId]
      );
      if (linkRes.rows.length === 0) {
        return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'No linked child found' } });
      }
    }

    const sessionRes = await query(
      `SELECT transcript FROM reading_sessions
       WHERE id = $1 AND student_id = $2 AND deleted_at IS NULL`,
      [sessionId, studentId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const transcript = sessionRes.rows[0].transcript;

    if (!transcript || !transcript.trim()) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No transcript available for this session' } });
    }

    const result = await synthesizeSpeech(transcript);

    if (Buffer.isBuffer(result)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', result.length);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(result);
    }

    return res.json({ useBrowserTts: true, transcript });
  } catch (error) {
    console.error('Error generating TTS playback:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate audio playback' } });
  }
});

export default router;
