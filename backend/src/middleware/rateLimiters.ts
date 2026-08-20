import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

// --- Rate limiting (Section 1e) ---
// In test environment, disable globalLimiter to avoid 429 in tests, but keep authLimiter for rate-limiting tests
const isTest = process.env.NODE_ENV?.trim() === 'test';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

export const globalLimiter = isTest
  ? (req: AuthRequest, res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
    });

// Audio upload limiter: 10 requests per hour per user (SEC-08)
export const audioUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
  message: { error: { code: 'RATE_LIMITED', message: 'Too many audio uploads, please try again later' } },
});

// LLM cost abuse protection limiter: 20 requests per hour per user (§4.4 / §11.1)
// NOT disabled in test mode — we explicitly test this rate limiter
export const llmLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: AuthRequest) => req.user?.id || ipKeyGenerator(req.ip || 'unknown'),
  message: { error: { code: 'RATE_LIMITED', message: 'LLM request rate limit exceeded (20 calls per hour max). Please try again later.' } },
});