import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { getClassHeatmap, getClassWeaknesses, getSkillDistribution } from '../services/classroomAnalytics';

const router = Router();

const requireTeacher = requireRole(['teacher', 'admin']);

// GET /api/v1/classroom/heatmap
// Get error heatmap across all students.
router.get('/heatmap', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const heatmap = await getClassHeatmap({ id: req.user?.id, role: req.user?.role });
    res.json({ heatmap });
  } catch (error) {
    console.error('Error fetching classroom heatmap:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch heatmap' } });
  }
});

// GET /api/v1/classroom/weaknesses
// Get class-wide weakness analysis.
router.get('/weaknesses', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const weaknesses = await getClassWeaknesses({ id: req.user?.id, role: req.user?.role });
    res.json({ weaknesses });
  } catch (error) {
    console.error('Error fetching class weaknesses:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch weaknesses' } });
  }
});

// GET /api/v1/classroom/skill-distribution
// Get skill distribution across the class.
router.get('/skill-distribution', authenticate, requireTeacher, async (req: AuthRequest, res) => {
  try {
    const distribution = await getSkillDistribution({ id: req.user?.id, role: req.user?.role });
    res.json({ distribution });
  } catch (error) {
    console.error('Error fetching skill distribution:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch distribution' } });
  }
});

export default router;
