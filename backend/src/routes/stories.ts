import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { llmLimiter } from '../middleware/rateLimiters';
import { generateStory, getStudentStories, getStoryById } from '../services/storyGenerator';
import { canAccessStudent } from '../services/studentAccess';

const router = Router();

// POST /api/v1/stories/generate
// Generate a new adaptive story for the authenticated student.
router.post('/generate', authenticate, llmLimiter, async (req: AuthRequest, res) => {
  const studentId = req.body.student_id || req.user?.id;

  const hasAccess = await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role });
  if (!hasAccess) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const story = await generateStory(studentId);
    res.status(201).json({ story });
  } catch (error) {
    console.error('Error generating story:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate story' } });
  }
});

// GET /api/v1/stories/student/:studentId
// Get all generated stories for a student.
router.get('/student/:studentId', authenticate, async (req: AuthRequest, res) => {
  const studentId = String(req.params.studentId);

  const hasAccess = await canAccessStudent(studentId, { id: req.user?.id, role: req.user?.role });
  if (!hasAccess) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  try {
    const stories = await getStudentStories(studentId);
    res.json({ stories });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stories' } });
  }
});

// GET /api/v1/stories/:id
// Get a single story by ID.
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const storyId = String(req.params.id);
    const story = await getStoryById(storyId);
    if (!story) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Story not found' } });
    }

    const hasAccess = await canAccessStudent(story.studentId, { id: req.user?.id, role: req.user?.role });
    if (!hasAccess) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    res.json({ story });
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch story' } });
  }
});

export default router;
