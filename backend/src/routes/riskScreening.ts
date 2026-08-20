import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { runRiskScreening, getLatestScreening } from '../services/riskScreening';
import { canAccessStudent } from '../services/studentAccess';

const router = Router();

// GET /api/v1/risk-screening/:studentId
// Get the latest risk screening for a student.
router.get('/:studentId', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);

  if (!(await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role }))) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const screening = await getLatestScreening(studentId);
    res.json({ screening });
  } catch (error) {
    console.error('Error fetching risk screening:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch screening' } });
  }
});

// POST /api/v1/risk-screening/:studentId/run
// Run a new risk screening. Teachers/admins only.
router.post('/:studentId/run', authenticate, requireRole(['teacher', 'admin']), async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);

  try {
    if (!(await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role }))) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const result = await runRiskScreening(studentId);
    res.json({ screening: result });
  } catch (error) {
    console.error('Error running risk screening:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to run screening' } });
  }
});

export default router;
