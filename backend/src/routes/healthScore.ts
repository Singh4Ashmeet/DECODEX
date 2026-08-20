import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { computeHealthScore, getLatestHealthScore, getHealthScoreHistory } from '../services/healthScore';
import { canAccessStudent } from '../services/studentAccess';

const router = Router();

// GET /api/v1/health-score/:studentId
// Get the latest health score for a student.
router.get('/:studentId', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);

  if (!(await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role }))) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const score = await getLatestHealthScore(studentId);
    if (!score) {
      return res.json({ healthScore: null, message: 'No health score computed yet. Complete a reading session first.' });
    }
    res.json({ healthScore: score });
  } catch (error) {
    console.error('Error fetching health score:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch health score' } });
  }
});

// GET /api/v1/health-score/:studentId/history
// Get health score history for trend charts.
router.get('/:studentId/history', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);

  if (!(await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role }))) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const history = await getHealthScoreHistory(studentId);
    res.json({ history });
  } catch (error) {
    console.error('Error fetching health score history:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch history' } });
  }
});

// POST /api/v1/health-score/:studentId/compute
// Force recompute health score for the latest session (teacher/admin only).
router.post('/:studentId/compute', authenticate, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);

  try {
    if (!(await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role }))) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    // Get the latest completed session
    const sessionRes = await (await import('../db')).query(
      `SELECT id FROM reading_sessions
       WHERE student_id = $1 AND status = 'completed' AND deleted_at IS NULL
       ORDER BY completed_at DESC LIMIT 1`,
      [studentId]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No completed sessions found' } });
    }

    const result = await computeHealthScore(sessionRes.rows[0].id, studentId);
    res.json({ healthScore: result });
  } catch (error) {
    console.error('Error computing health score:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to compute health score' } });
  }
});

export default router;
