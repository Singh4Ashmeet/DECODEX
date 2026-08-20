import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateLearningPath, getActiveLearningPath, completeDayTask } from '../services/learningPath';

const router = Router();

// GET /api/v1/learning-paths/:studentId
// Get the active learning path for a student.
router.get('/:studentId', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const requesterRole = req.user?.role;
  const requesterId = req.user?.id;

  if (requesterRole === 'student' && requesterId !== studentId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const path = await getActiveLearningPath(studentId);
    res.json({ learningPath: path });
  } catch (error) {
    console.error('Error fetching learning path:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch learning path' } });
  }
});

// POST /api/v1/learning-paths/:studentId/generate
// Generate a new learning path for a student.
router.post('/:studentId/generate', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);
  const requesterRole = req.user?.role;
  const requesterId = req.user?.id;

  // Students can generate for themselves, teachers/admins for any student
  if (requesterRole === 'student' && requesterId !== studentId) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const path = await generateLearningPath(studentId);
    res.status(201).json({ learningPath: path });
  } catch (error: any) {
    if (error.code === 'INSUFFICIENT_SESSIONS') {
      return res.status(400).json({ error: { code: 'INSUFFICIENT_SESSIONS', message: error.message, details: error.details } });
    }
    console.error('Error generating learning path:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate learning path' } });
  }
});

// PATCH /api/v1/learning-paths/:pathId/weeks/:weekNumber/days/:dayNumber/complete
// Mark a day task as completed and award XP.
router.patch('/:pathId/weeks/:weekNumber/days/:dayNumber/complete', authenticate, async (req: AuthRequest, res) => {
  const pathId = String(req.params.pathId);
  const weekNumber = parseInt(String(req.params.weekNumber), 10);
  const dayNumber = parseInt(String(req.params.dayNumber), 10);
  const studentId = req.user?.id || '';

  try {
    await completeDayTask(pathId, weekNumber, dayNumber, studentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error completing day task:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to complete day task' } });
  }
});

export default router;
