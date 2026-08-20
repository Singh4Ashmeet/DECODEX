import { Router } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/v1/analytics/student/trends
router.get('/student/trends', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
         rs.started_at as date,
         rs.words_per_minute,
         ep.error_rate,
         ep.total_words_read,
         ep.total_errors,
         ep.rev_count,
         ep.sub_count,
         ep.omi_count,
         ep.ins_count,
         ep.bld_count,
         ep.pac_count,
         ep.uncertain_count
       FROM error_profiles ep
       JOIN reading_sessions rs ON ep.session_id = rs.id
       WHERE ep.student_id = $1
       ORDER BY rs.started_at ASC
       LIMIT 10`,
      [(req as any).user?.id]
    );

    res.json({ trends: result.rows });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trends' } });
  }
});

export default router;
