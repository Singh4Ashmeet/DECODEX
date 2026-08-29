import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiters';
import { sendPasswordResetEmail } from '../services/email';
import { encryptUserPII, decryptUserPII, decryptPII, isEncrypted, hashEmail } from '../services/piiEncryption';
import { verifyTOTP, isMFARequired } from '../services/mfa';

// Account lockout constants (C-2)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
};

interface ParentRegistrationBody {
  email?: unknown;
  password?: unknown;
  display_name?: unknown;
}

// POST /api/v1/auth/register
router.post('/register', async (req, res) => {
  const { email, password, display_name, grade_level } = req.body;
  
  if (!email || !password || !display_name) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
  }

  const role = 'student';

  try {
    const password_hash = await bcrypt.hash(password, 12);
    const invite_code = randomBytes(3).toString('hex').toUpperCase();
    
    // Encrypt PII fields
    const encryptedEmail = encryptUserPII({ email }).email;
    const encryptedDisplayName = encryptUserPII({ display_name }).display_name;
    const emailHash = hashEmail(email);
    
    const result = await query(
      `INSERT INTO users (email, password_hash, role, display_name, grade_level, invite_code, email_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, role, display_name, preferred_language`,
      [encryptedEmail, password_hash, role, encryptedDisplayName, grade_level ?? null, invite_code, emailHash]
    );

    const user = decryptUserPII(result.rows[0]);
    const token = jwt.sign({ id: user.id, role: user.role, preferredLanguage: user.preferred_language }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, getCookieOptions());

    // SECURITY (C-1): Token is in the httpOnly cookie only — do NOT return it in the body.
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Email already exists' } });
    }
    console.error('Auth register error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : (error.message || 'Server error') } });
  }
});

// POST /api/v1/auth/register/parent
router.post('/register/parent', async (req, res) => {
  const { email, password, display_name } = req.body as ParentRegistrationBody;

  if (typeof email !== 'string' || typeof password !== 'string' || typeof display_name !== 'string' || !email || !password || !display_name) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
  }

  const role = 'parent';

  try {
    const password_hash = await bcrypt.hash(password, 12);

    // Encrypt PII fields
    const encryptedEmail = encryptUserPII({ email }).email;
    const encryptedDisplayName = encryptUserPII({ display_name }).display_name;
    const emailHash = hashEmail(email);

    const result = await query(
      `INSERT INTO users (email, password_hash, role, display_name, email_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, display_name, preferred_language`,
      [encryptedEmail, password_hash, role, encryptedDisplayName, emailHash]
    );

    const user = decryptUserPII(result.rows[0]);
    const token = jwt.sign({ id: user.id, role: user.role, preferredLanguage: user.preferred_language }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, getCookieOptions());

    // SECURITY (C-1): Token is in the httpOnly cookie only — do NOT return it in the body.
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error: unknown) {
    if (isPostgresUniqueViolation(error)) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Email already exists' } });
    }
    console.error('Auth register parent error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : ((error as Error).message || 'Server error') } });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { email, password, mfaToken } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
  }

  try {
    // Look up user by deterministic email hash (HMAC-SHA256)
    const emailLower = email.trim().toLowerCase();
    const emailHash = hashEmail(emailLower);
    let result = await query('SELECT * FROM users WHERE email_hash = $1 AND deleted_at IS NULL', [emailHash]);
    
    // FALLBACK: legacy users registered before email_hash migration (V14)
    // Their email_hash is NULL, so the hash lookup misses. Scan by decrypting.
    if (result.rows.length === 0) {
      const legacy = await query(
        "SELECT * FROM users WHERE email_hash IS NULL AND deleted_at IS NULL",
        []
      );
      for (const row of legacy.rows) {
        try {
          const decryptedEmail = isEncrypted(row.email) ? decryptPII(row.email) : row.email;
          if (decryptedEmail.toLowerCase().trim() === emailLower) {
            // Backfill email_hash for this user so future lookups are fast
            await query('UPDATE users SET email_hash = $1 WHERE id = $2', [emailHash, row.id]);
            result = { rows: [row], rowCount: 1, command: 'SELECT', oid: 0, fields: [] } as any;
            break;
          }
        } catch { /* encrypted with wrong key or corrupt — skip */ }
      }
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }

    const user = decryptUserPII(result.rows[0]);

    // SECURITY (C-2): Enforce per-account lockout before doing expensive bcrypt work.
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const retryAfterSec = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to too many failed login attempts. Try again later.',
        },
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      // Increment failed attempts and lock if threshold reached
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await query(
          'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
          [newAttempts, lockUntil, user.id]
        );
      } else {
        await query(
          'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
          [newAttempts, user.id]
        );
      }
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
    }

    // Reset lockout state on successful credential check
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
        [user.id]
      );
    }

    // Check if MFA is required and enabled for this user
    if (isMFARequired(user.role) && user.mfa_enabled) {
      if (!mfaToken || typeof mfaToken !== 'string' || mfaToken.length !== 6) {
        return res.status(401).json({ 
          error: { 
            code: 'MFA_REQUIRED', 
            message: 'MFA token required',
            details: { mfaRequired: true }
          } 
        });
      }

      if (!user.totp_secret || !verifyTOTP(mfaToken, user.totp_secret)) {
        return res.status(401).json({ 
          error: { 
            code: 'INVALID_MFA_TOKEN', 
            message: 'Invalid MFA token',
            details: { mfaRequired: true }
          } 
        });
      }
    }

    const token = jwt.sign({ id: user.id, role: user.role, preferredLanguage: user.preferred_language }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, getCookieOptions());

    // SECURITY (C-1): Token is in the httpOnly cookie only — do NOT return it in the body.
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error: any) {
    console.error('Auth login error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : (error.message || 'Server error') } });
  }
});

const getClearCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  };
};

// POST /api/v1/auth/logout
router.post('/logout', (req, res) => {
  const clearOpts = getClearCookieOptions();
  res.cookie('token', '', clearOpts);
  res.clearCookie('token', clearOpts);
  res.json({ success: true });
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query('SELECT id, email, role, display_name, preferred_language FROM users WHERE id = $1', [req.user?.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    const user = decryptUserPII(result.rows[0]);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error: any) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : (error.message || 'Server error') } });
  }
});

// PATCH /api/v1/auth/me
// Update authenticated user's preferred_language.
// Validates against supported languages. Reads fresh from DB on GET /me (no JWT re-issue needed).
// Language is not an auth claim, so DB read-through is simpler and consistent with /me behavior.
// Role field is explicitly rejected - roles cannot be changed via API (SEC-10).
const SUPPORTED_LANGUAGES = ['en', 'hi'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

router.patch('/me', authenticate, async (req: AuthRequest, res) => {
  const { preferredLanguage, role } = req.body;

  // SEC-10: Reject any attempt to modify role via API
  if (role !== undefined) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Role cannot be modified via API' },
    });
  }

  if (preferredLanguage === undefined || preferredLanguage === null) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'preferredLanguage is required' },
    });
  }

  if (typeof preferredLanguage !== 'string') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'preferredLanguage must be a string' },
    });
  }

  if (!SUPPORTED_LANGUAGES.includes(preferredLanguage as SupportedLanguage)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` },
    });
  }

  try {
    const result = await query(
      `UPDATE users SET preferred_language = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role, display_name, preferred_language`,
      [preferredLanguage, req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const user = decryptUserPII(result.rows[0]);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        preferredLanguage: user.preferred_language
      }
    });
  } catch (error: any) {
    console.error('Auth update me error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: process.env.NODE_ENV === 'production' ? 'An internal error occurred' : (error.message || 'Server error') } });
  }
});

// POST /api/v1/auth/password-reset/request
// Request a password reset/set link (for accounts that don't have a usable password yet)
// SECURITY (M-3): Apply auth rate limiter to prevent email flood attacks.
router.post('/password-reset/request', authLimiter, async (req, res) => {
  const { email } = req.body;

  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required' } });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } });
  }

  try {
    // Look up by deterministic email hash
    const emailHash = hashEmail(email.trim());
    
    const result = await query(
      'SELECT id FROM users WHERE email_hash = $1 AND role = \'parent\' AND deleted_at IS NULL',
      [emailHash]
    );

    // Always return 200 to avoid email enumeration
    if (result.rows.length === 0) {
      return res.json({ password_reset_requested: true });
    }

    const user = result.rows[0];
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [token, expiresAt, user.id]
    );

    await sendPasswordResetEmail(email.trim().toLowerCase(), token);

    res.json({ password_reset_requested: true });
  } catch {
    console.error('Failed to request password reset.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /api/v1/auth/password-reset/confirm
// Confirm password reset/set with token and new password
router.post('/password-reset/confirm', async (req, res) => {
  const { token, password } = req.body;

  if (typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Token is required' } });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } });
  }

  try {
    const result = await query(
      'SELECT id FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW() AND deleted_at IS NULL',
      [token.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' } });
    }

    const user = result.rows[0];
    const passwordHash = await bcrypt.hash(password, 12);

    // SECURITY (M-4): Fetch actual role and preferred_language from DB instead of hardcoding.
    const userRecord = await query(
      'SELECT role, preferred_language FROM users WHERE id = $1 AND deleted_at IS NULL',
      [user.id]
    );
    const { role: userRole, preferred_language: userLang } = userRecord.rows[0] || { role: 'parent', preferred_language: 'en' };

    await query(
      'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $2',
      [passwordHash, user.id]
    );

    // Issue JWT and set cookie using actual role from DB
    const jwtToken = jwt.sign({ id: user.id, role: userRole, preferredLanguage: userLang || 'en' }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true });
  } catch {
    console.error('Failed to confirm password reset.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

export default router;

function isPostgresUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === '23505';
}
