import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/auth';
import { synthesizeSpeech, synthesizePhrase, isValidPhraseId, PHRASE_BANK, type PhraseId, type SupportedLanguage } from '../services/tts';

const router = Router();

// Dedicated rate limiter for TTS — controls cost on a paid API
const ttsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 TTS requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many TTS requests, please try again later' } },
});

// POST /api/v1/tts
// Synthesize speech from text. Returns audio/mpeg or { useBrowserTts: true }.
// Used for dynamic/transcript content (e.g., student recording playback) — NOT cached.
router.post('/', authenticate, ttsLimiter, async (req: AuthRequest, res) => {
  const { text } = req.body;

  // Validate input
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'text is required and must be a non-empty string' },
    });
  }

  if (text.length > 1000) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'text must be 1000 characters or fewer' },
    });
  }

  try {
    const result = await synthesizeSpeech(text.trim());

    if (result.useBrowserTts || !result.audioBuffer) {
      return res.status(200).json({ useBrowserTts: true });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(result.audioBuffer.length),
      'Cache-Control': 'no-cache',
    });
    return res.send(result.audioBuffer);
  } catch (err) {
    console.error('TTS route error:', err);
    // Even on unexpected errors, fall back rather than showing an error to a child
    return res.status(200).json({ useBrowserTts: true });
  }
});

// POST /api/v1/tts/phrase
// Synthesize speech for a stock phrase from the phrase bank.
// Accepts { phraseId, language? } instead of raw text. Looks up phrase server-side, checks Redis cache by phraseId:language.
// Returns cached audio if present — otherwise synthesizes once and caches with 30-day TTL.
// Used for repeated encouragement/instruction phrases (never transcript content).
router.post('/phrase', authenticate, ttsLimiter, async (req: AuthRequest, res) => {
  const { phraseId, language = 'en' } = req.body;

  // Validate input
  if (!phraseId || typeof phraseId !== 'string') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'phraseId is required and must be a string' },
    });
  }

  if (!isValidPhraseId(phraseId)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: `Invalid phraseId. Valid options: ${Object.keys(PHRASE_BANK).join(', ')}` },
    });
  }

  // Validate language (optional, but if provided must be a string)
  if (language !== undefined && typeof language !== 'string') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'language must be a string' },
    });
  }

  try {
    const result = await synthesizePhrase(phraseId, language as SupportedLanguage);

    if (result.useBrowserTts || !result.audioBuffer) {
      return res.status(200).json({ useBrowserTts: true });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(result.audioBuffer.length),
      'Cache-Control': 'public, max-age=2592000', // 30 days
    });
    return res.send(result.audioBuffer);
  } catch (err) {
    console.error('TTS phrase route error:', err);
    return res.status(200).json({ useBrowserTts: true });
  }
});

export default router;
