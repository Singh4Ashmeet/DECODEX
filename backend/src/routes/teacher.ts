import { Router } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// Reuse the shared requireRole middleware instead of reimplementing inline.
const requireTeacher = requireRole(['teacher', 'admin']);

// GET /api/v1/teacher/students
router.get('/students', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `
      SELECT
        u.id,
        u.display_name,
        u.grade_level,
        COUNT(DISTINCT rs.id) as session_count,
        MAX(rs.started_at) as last_active,
        AVG(rs.words_per_minute) as avg_wpm,
        AVG(ep.error_rate) as avg_error_rate,
        -- Latest health score data
        hs.score as latest_health_score,
        hs.risk_level as health_risk_level,
        hs.computed_at as health_score_date,
        -- Latest error profile aggregates
        ep_latest.rev_count,
        ep_latest.sub_count,
        ep_latest.omi_count,
        ep_latest.ins_count,
        ep_latest.bld_count,
        ep_latest.pac_count,
        ep_latest.uncertain_count,
        -- Learning path status
        lp.status as learning_path_status,
        lp.current_week as learning_path_week
      FROM users u
      LEFT JOIN reading_sessions rs ON u.id = rs.student_id AND rs.deleted_at IS NULL
      LEFT JOIN error_profiles ep ON rs.id = ep.session_id
      LEFT JOIN LATERAL (
        SELECT score, risk_level, computed_at
        FROM health_scores
        WHERE student_id = u.id
        ORDER BY computed_at DESC
        LIMIT 1
      ) hs ON true
      LEFT JOIN LATERAL (
        SELECT rev_count, sub_count, omi_count, ins_count, bld_count, pac_count, uncertain_count
        FROM error_profiles
        WHERE student_id = u.id
        ORDER BY computed_at DESC
        LIMIT 1
      ) ep_latest ON true
      LEFT JOIN LATERAL (
        SELECT status, current_week
        FROM learning_paths
        WHERE student_id = u.id AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      ) lp ON true
      WHERE u.role = 'student' AND u.deleted_at IS NULL
        AND (
          $1 = 'admin'
          OR EXISTS (
            SELECT 1 FROM teacher_student_links tsl
            WHERE tsl.teacher_id = $2
              AND tsl.student_id = u.id
          )
        )
      GROUP BY u.id, hs.score, hs.risk_level, hs.computed_at, ep_latest.rev_count, ep_latest.sub_count, ep_latest.omi_count, ep_latest.ins_count, ep_latest.bld_count, ep_latest.pac_count, ep_latest.uncertain_count, lp.status, lp.current_week
      ORDER BY u.display_name ASC
      `,
      [req.user?.role, req.user?.id]
    );

    // Safety net: warn if teacher has zero linked students
    if (req.user?.role === 'teacher' && result.rows.length === 0) {
      console.warn(
        `[EMPTY ROSTER] Teacher ${req.user?.id} has no students linked via teacher_student_links. ` +
        `Dashboard will appear empty. Admin should assign students or teacher should create assignments.`
      );
    }

    res.json({ students: result.rows });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch students' } });
  }
});

// GET /api/v1/teacher/students/:id/trends
router.get('/students/:id/trends', authenticate, requireTeacher, async (req: any, res: any) => {
  const authReq = req as AuthRequest;
  try {
    const result = await query(
      `SELECT 
         rs.started_at as date,
         rs.words_per_minute,
         rs.duration_seconds,
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
       JOIN users u ON u.id = ep.student_id
       WHERE ep.student_id = $1 AND rs.deleted_at IS NULL
         AND u.role = 'student'
         AND u.deleted_at IS NULL
         AND (
           $2 = 'admin'
           OR EXISTS (
             SELECT 1 FROM teacher_student_links tsl
             WHERE tsl.teacher_id = $3
               AND tsl.student_id = u.id
           )
         )
       ORDER BY rs.started_at ASC
       LIMIT 10`,
      [req.params.id, req.user?.role, req.user?.id]
    );

    res.json({ trends: result.rows });
  } catch (error) {
    console.error('Error fetching student trends:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trends' } });
  }
});

export default router;
