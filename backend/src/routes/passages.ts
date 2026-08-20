import { Router } from 'express';
import { query } from '../db';
import { authenticate } from '../middleware/auth';
import { llmLimiter } from '../middleware/rateLimiters';
import { generatePassage } from '../services/passageGenerator';

const router = Router();

// GET /api/v1/passages
router.get('/', authenticate, async (req, res) => {
  try {
    const { grade_level } = req.query;
    
    let dbQuery = 'SELECT id, title, content, grade_level, lexile_score, word_count FROM passages';
    const params = [];
    
    if (grade_level) {
      dbQuery += ' WHERE grade_level = $1';
      params.push(parseInt(grade_level as string, 10));
    }
    
    dbQuery += ' ORDER BY created_at DESC, grade_level ASC, title ASC';
    
    const result = await query(dbQuery, params);
    res.json({ passages: result.rows });
  } catch (error) {
    console.error('Error fetching passages:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch passages' } });
  }
});

// POST /api/v1/passages/generate
// Dynamically generate a brand-new AI reading passage.
router.post('/generate', authenticate, llmLimiter, async (req, res) => {
  try {
    const gradeLevel = req.body?.grade_level ? parseInt(req.body.grade_level, 10) : 3;
    const passage = await generatePassage(gradeLevel);
    res.status(201).json({ passage });
  } catch (error) {
    console.error('Error generating passage:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate passage' } });
  }
});

// GET /api/v1/passages/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM passages WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Passage not found' } });
    }
    res.json({ passage: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch passage' } });
  }
});

export default router;
