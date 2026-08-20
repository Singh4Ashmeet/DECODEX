import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireConsent } from '../middleware/consent';
import { upload, validateUploadedAudioFile } from '../middleware/upload';
import { gradeSpokenAnswer, type DexLanguage } from '../services/dexTutor';
import { transcribeAudio } from '../services/openai';
import { query } from '../db';
import fs from 'fs';
import { audioUploadLimiter } from '../middleware/rateLimiters';

const router = Router();

// Shared rate limiter for Dex endpoints
const dexLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

// POST /api/v1/dex/grade-answer
// Grade a student's spoken answer against an expected answer.
// Requires parental consent for minor students.
router.post('/grade-answer', authenticate, requireConsent, dexLimiter, async (req: AuthRequest, res) => {
  const { question, expectedAnswer, studentTranscript } = req.body;

  // Validate all three fields
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'question is required and must be a non-empty string' },
    });
  }
  if (question.length > 2000) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'question must be 2000 characters or fewer' },
    });
  }

  if (!expectedAnswer || typeof expectedAnswer !== 'string' || expectedAnswer.trim().length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'expectedAnswer is required and must be a non-empty string' },
    });
  }
  if (expectedAnswer.length > 2000) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'expectedAnswer must be 2000 characters or fewer' },
    });
  }

  if (!studentTranscript || typeof studentTranscript !== 'string' || studentTranscript.trim().length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'studentTranscript is required and must be a non-empty string' },
    });
  }
  if (studentTranscript.length > 2000) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'studentTranscript must be 2000 characters or fewer' },
    });
  }

  // Use the student's preferred_language from JWT (or fetch from DB for freshness)
  const studentPreferredLanguage = (req.user as any)?.preferredLanguage as DexLanguage || 'en';

  try {
    const result = await gradeSpokenAnswer(
      question.trim(),
      expectedAnswer.trim(),
      studentTranscript.trim(),
      studentPreferredLanguage,
    );
    res.json(result);
  } catch (err) {
    console.error('Grading route error:', err);
    // Fallback response — never leave the student stuck
    res.json({
      correct: false,
      feedback: 'Let\'s try that one more time!',
    });
  }
});

// POST /api/v1/dex/transcribe
// Transcribe uploaded audio using the existing Whisper STT service.
// Requires parental consent (same gate as session audio upload).
router.post('/transcribe', authenticate, requireConsent, audioUploadLimiter, upload.single('audio'), async (req: AuthRequest, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'audio file is required' },
    });
  }

  // Use the student's preferred_language from JWT (or fetch from DB for freshness)
  const studentPreferredLanguage = (req.user as any)?.preferredLanguage as DexLanguage || 'en';

  try {
    // Validate magic bytes after file is written to disk
    await validateUploadedAudioFile(file.path);
    
    const transcript = await transcribeAudio(file.path, undefined, studentPreferredLanguage);
    res.json({ transcript });
  } catch (err) {
    console.error('Transcription route error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'Failed to transcribe audio'
          : (err instanceof Error ? err.message : 'Failed to transcribe audio'),
      },
    });
  } finally {
    // Clean up temp file — never persist raw audio (privacy requirement)
    try {
      if (file?.path) fs.unlinkSync(file.path);
    } catch { /* ignore cleanup errors */ }
  }
});

export default router;
