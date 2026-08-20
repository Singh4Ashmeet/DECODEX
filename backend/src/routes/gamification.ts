import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getProfile, getAchievements } from '../services/gamification';

const router = Router();

// GET /api/v1/gamification/:studentId/profile
// Get a student's gamification profile (XP, level, streak).
router.get('/:studentId/profile', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const requesterRole = req.user?.role;
  const requesterId = req.user?.id;

  if (requesterRole === 'student' && requesterId !== studentId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const profile = await getProfile(studentId);
    res.json({ profile });
  } catch (error) {
    console.error('Error fetching gamification profile:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch profile' } });
  }
});

// GET /api/v1/gamification/:studentId/achievements
// Get all achievements with earned status for a student.
router.get('/:studentId/achievements', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const requesterRole = req.user?.role;
  const requesterId = req.user?.id;

  if (requesterRole === 'student' && requesterId !== studentId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const achievements = await getAchievements(studentId);
    res.json({ achievements });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch achievements' } });
  }
});

export default router;
