import { Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';
import { pool, query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { sendConsentEmail, sendConsentWithdrawalEmail, sendPasswordResetEmail, sendConsentRenewalEmail } from '../services/email';
import { encryptUserPII, decryptUserPII, decryptPII, isEncrypted, hashEmail } from '../services/piiEncryption';
import { eraseConsentDataForLink } from '../queue/consentErasure';

const router = Router();

// Dedicated rate limiter for consent confirmation (matches spec exactly)
const consentConfirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many verification attempts, please try again later' } },
});

interface LinkStudentBody {
  invite_code?: unknown;
}

interface RequestConsentBody {
  student_id?: unknown;
}

interface ConfirmConsentBody {
  date_of_birth?: unknown;
  agree?: unknown;
}

interface WithdrawConsentBody {
  student_id?: unknown;
}

interface RequestUnverifiedConsentBody {
  email?: unknown;
  invite_code?: unknown;
}

interface ParentAccount {
  email: string;
}

interface LinkedStudent {
  id: string;
  display_name: string;
  grade_level: number | null;
}

interface PendingConsentLink extends LinkedStudent {
  parent_email: string;
}

interface ConsentTokenRecord {
  parent_id: string | null;
  student_id: string;
  email: string | null;
  date_of_birth: string | Date | null;
  failed_attempts: number;
  last_attempt_at: string | Date | null;
}

interface ConsentStatus {
  consent_granted: boolean;
  consent_date: string | null;
}

interface LinkedChild extends LinkedStudent {
  consent_granted: boolean;
  consent_date: string | Date | null;
  withdrawn_at: string | Date | null;
  hard_delete_at: string | Date | null;
}

interface WithdrawnConsentLink {
  parent_email: string;
  student_name: string;
  hard_delete_at: string | Date;
}

// POST /api/v1/consent/link
router.post('/link', authenticate, requireRole(['parent', 'admin']), async (req: AuthRequest, res: Response) => {
  const { invite_code } = (req.body as LinkStudentBody) ?? {};

  if (typeof invite_code !== 'string' || !invite_code.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invite code is required' } });
  }

  try {
    const parentResult = await query(
      [
        'SELECT email FROM users',
        "WHERE id = $1 AND role IN ('parent', 'admin') AND deleted_at IS NULL",
      ].join('\n'),
      [req.user!.id]
    );
    const parent = parentResult.rows[0] as ParentAccount | undefined;

    if (!parent) {
      return res.status(401).json({ error: { code: 'AUTH_EXPIRED', message: 'Parent account is no longer active' } });
    }

    const studentResult = await query(
      [
        'SELECT id, display_name, grade_level',
        'FROM users',
        "WHERE invite_code = $1 AND role = 'student' AND deleted_at IS NULL",
      ].join('\n'),
      [invite_code.trim()]
    );
    const student = studentResult.rows[0] as LinkedStudent | undefined;

    if (!student) {
      return res.status(404).json({ error: { code: 'INVALID_CODE', message: 'Invalid invite code' } });
    }

    const linkResult = await query(
      [
        'INSERT INTO parent_student_links (parent_id, student_id)',
        'VALUES ($1, $2)',
        'ON CONFLICT (parent_id, student_id) DO NOTHING',
        'RETURNING parent_id',
      ].join('\n'),
      [req.user!.id, student.id]
    );

    if (linkResult.rows.length === 0) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Parent is already linked to this student' } });
    }

    // Email dispatch is no longer required; links are managed in-app via the web UI.
    // Decrypt PII fields before passing to token/email services (they expect plaintext).
    try {
      const parentEmail = isEncrypted(parent.email) ? decryptPII(parent.email) : parent.email;
      const studentName = isEncrypted(student.display_name) ? decryptPII(student.display_name) : student.display_name;
      const token = await issueConsentToken(req.user!.id, student.id, parentEmail, studentName);
      try {
        await sendConsentEmail(parentEmail, token, studentName);
      } catch (emailErr) {
        console.error('[Consent] Consent link email delivery failed:', emailErr);
      }
    } catch {
      // Token creation itself failed — log but don't block the link
    }

    res.status(201).json({
      student: {
        id: student.id,
        display_name: isEncrypted(student.display_name) ? decryptPII(student.display_name) : student.display_name,
        grade_level: student.grade_level,
      },
    });
  } catch {
    console.error('Failed to link parent and student.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /api/v1/consent/approve — REMOVED (security: was a consent bypass with no DOB check)
// This endpoint is permanently gone. Consent may only be granted through
// POST /consent/:token/confirm which requires a time-limited token + date-of-birth verification.
// Returns 410 Gone so callers get an explicit "this is intentionally removed" signal.
router.post('/approve', (_req, res: Response) => {
  return res.status(410).json({
    error: {
      code: 'ENDPOINT_REMOVED',
      message:
        'POST /consent/approve has been removed. Parental consent must be granted through the email verification link (POST /consent/:token/confirm), which requires date-of-birth verification.',
    },
  });
});

// POST /api/v1/consent/request
router.post('/request', authenticate, requireRole(['parent', 'admin']), async (req: AuthRequest, res: Response) => {
  const { student_id } = (req.body as RequestConsentBody) ?? {};

  if (typeof student_id !== 'string' || !student_id.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Student ID is required' } });
  }

  try {
    const linkResult = await query(
      [
        'SELECT student.id, student.display_name, student.grade_level, parent.email AS parent_email',
        'FROM parent_student_links link',
        'JOIN users student ON student.id = link.student_id',
        'JOIN users parent ON parent.id = link.parent_id',
        "WHERE link.parent_id = $1 AND link.student_id = $2 AND link.consent_granted = FALSE",
        'AND student.deleted_at IS NULL AND parent.deleted_at IS NULL',
      ].join('\n'),
      [req.user!.id, student_id.trim()]
    );
    const pendingLink = linkResult.rows[0] as PendingConsentLink | undefined;

    if (!pendingLink) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No pending consent link found' } });
    }

    await query(
      [
        'UPDATE consent_tokens',
        'SET expires_at = NOW()',
        'WHERE parent_id = $1 AND student_id = $2 AND used_at IS NULL',
      ].join('\n'),
      [req.user!.id, pendingLink.id]
    );

    const reqParentEmail = isEncrypted(pendingLink.parent_email) ? decryptPII(pendingLink.parent_email) : pendingLink.parent_email;
    const reqStudentName = isEncrypted(pendingLink.display_name) ? decryptPII(pendingLink.display_name) : pendingLink.display_name;

    // Create the consent token; email delivery is best-effort and must not
    // fail the request (the token is already committed to the DB).
    const token = await issueConsentToken(req.user!.id, pendingLink.id, reqParentEmail, reqStudentName);
    let emailSent = true;
    try {
      await sendConsentEmail(reqParentEmail, token, reqStudentName);
    } catch (emailErr) {
      console.error('[Consent] Email delivery failed for existing token:', emailErr);
      emailSent = false;
    }

    res.status(201).json({ consent_email_requested: true, consent_email_sent: emailSent });
  } catch {
    console.error('Failed to request consent email.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /api/v1/consent/request-unverified
// Unauthenticated endpoint: parent provides email + student invite_code.
// Creates a consent token with parent_id=NULL and email=provided_email.
// No parent_student_links row is created yet; that happens on confirm.
router.post('/request-unverified', async (req, res: Response) => {
  const { email, invite_code } = (req.body as RequestUnverifiedConsentBody) ?? {};

  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Email is required' } });
  }
  if (typeof invite_code !== 'string' || !invite_code.trim()) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invite code is required' } });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } });
  }

  try {
    const studentResult = await query(
      [
        'SELECT id, display_name, date_of_birth',
        'FROM users',
        "WHERE invite_code = $1 AND role = 'student' AND deleted_at IS NULL",
      ].join('\n'),
      [invite_code.trim().toUpperCase()]
    );
    const student = studentResult.rows[0] as { id: string; display_name: string; date_of_birth: string | Date | null } | undefined;

    if (!student) {
      return res.status(404).json({ error: { code: 'INVALID_CODE', message: 'Invalid invite code' } });
    }

    // Invalidate any existing unused consent tokens for this email+student
    await query(
      [
        'UPDATE consent_tokens',
        'SET expires_at = NOW()',
        'WHERE student_id = $1 AND email = $2 AND used_at IS NULL',
      ].join('\n'),
      [student.id, email.trim().toLowerCase()]
    );

    // Issue token with parent_id=NULL, email=provided email
    const unverifiedToken = await issueConsentToken(null, student.id, email.trim().toLowerCase(), student.display_name);
    let emailSent = true;
    try {
      await sendConsentEmail(email.trim().toLowerCase(), unverifiedToken, student.display_name);
    } catch (emailErr) {
      console.error('[Consent] Unverified consent email delivery failed:', emailErr);
      emailSent = false;
    }

    res.status(201).json({ consent_email_sent: emailSent });
  } catch {
    console.error('Failed to send unverified consent email.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /api/v1/consent/children
router.get('/children', authenticate, requireRole(['parent', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      [
        'SELECT student.id, student.display_name, student.grade_level,',
        'link.consent_granted, link.consent_date, link.withdrawn_at, link.hard_delete_at',
        'FROM parent_student_links link',
        'JOIN users student ON student.id = link.student_id',
        'WHERE link.parent_id = $1 AND student.deleted_at IS NULL',
        'ORDER BY student.display_name ASC',
      ].join('\n'),
      [req.user!.id]
    );

    const children = result.rows.map(row => ({
      ...row,
      display_name: isEncrypted(row.display_name) ? decryptPII(row.display_name) : row.display_name,
    }));
    res.json({ children });
  } catch {
    console.error('Failed to fetch linked children.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /api/v1/consent/withdraw
router.post('/withdraw', authenticate, requireRole(['parent', 'admin']), async (req: AuthRequest, res: Response) => {
  const { student_id } = (req.body as WithdrawConsentBody) ?? {};

  if (typeof student_id !== 'string' || !isUuid(student_id)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'A valid student ID is required' } });
  }

  try {
    const result = await query(
      [
        'UPDATE parent_student_links link',
        "SET consent_granted = FALSE, withdrawn_at = NOW(), hard_delete_at = NOW() + INTERVAL '30 days'",
        'FROM users parent, users student',
        'WHERE link.parent_id = $1 AND link.student_id = $2',
        'AND link.consent_granted = TRUE AND link.withdrawn_at IS NULL',
        'AND parent.id = link.parent_id AND student.id = link.student_id',
        'RETURNING parent.email AS parent_email, student.display_name AS student_name, link.hard_delete_at',
      ].join('\n'),
      [req.user!.id, student_id.trim()]
    );
    const withdrawnLink = result.rows[0] as WithdrawnConsentLink | undefined;

    if (!withdrawnLink) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No active consent link found' } });
    }

    await sendConsentWithdrawalEmail(withdrawnLink.parent_email, withdrawnLink.student_name);

    res.json({
      consent_granted: false,
      hard_delete_at: withdrawnLink.hard_delete_at,
    });
  } catch {
    console.error('Failed to withdraw parental consent.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /api/v1/consent/:linkId/force-purge
router.post('/:linkId/force-purge', authenticate, requireRole(['admin']), async (req, res) => {
  const { linkId } = req.params;

  if (typeof linkId !== 'string' || !isUuid(linkId)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid consent link ID' } });
  }

  try {
    const result = await eraseConsentDataForLink(linkId, true);

    if (result === 'not_eligible') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No pending consent deletion found' } });
    }

    if (result === 'skipped_active_consent') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Another parent has active consent for this student' } });
    }

    res.json({ purged: true });
  } catch {
    console.error('Failed to force purge consent-related data.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /api/v1/consent/:token
router.get('/:token', async (req, res) => {
  try {
    const result = await query(
      [
        'SELECT student.display_name, student.grade_level, token.failed_attempts',
        'FROM consent_tokens token',
        'JOIN users student ON student.id = token.student_id',
        'WHERE token.token = $1 AND token.used_at IS NULL AND token.expires_at > NOW()',
        'AND student.deleted_at IS NULL',
      ].join('\n'),
      [req.params.token]
    );
    const tokenRecord = result.rows[0] as (Omit<LinkedStudent, 'id'> & { failed_attempts: number }) | undefined;

    if (!tokenRecord) {
      return res.status(404).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired consent link' } });
    }

    const { failed_attempts, ...student } = tokenRecord;
    // Decrypt PII fields for the consent page display
    const decryptedStudent = {
      display_name: isEncrypted(student.display_name) ? decryptPII(student.display_name) : student.display_name,
      grade_level: student.grade_level,
    };
    res.json({ student: decryptedStudent, attempts_remaining: Math.max(0, 5 - failed_attempts) });
  } catch {
    console.error('Failed to validate consent token.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// POST /api/v1/consent/:token/confirm
router.post('/:token/confirm', consentConfirmLimiter, async (req, res) => {
  const { date_of_birth, agree } = (req.body as ConfirmConsentBody) ?? {};

  if (agree !== true) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Consent agreement is required' } });
  }

  if (!isValidDate(date_of_birth)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Date of birth must use YYYY-MM-DD format' } });
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const tokenResult = await client.query(
      [
        'SELECT token.parent_id, token.email, token.student_id, token.failed_attempts, token.last_attempt_at, student.date_of_birth',
        'FROM consent_tokens token',
        'JOIN users student ON student.id = token.student_id',
        'WHERE token.token = $1 AND token.used_at IS NULL AND token.expires_at > NOW()',
        'AND student.deleted_at IS NULL',
        'FOR UPDATE OF token',
      ].join('\n'),
      [req.params.token]
    );
    const tokenRecord = tokenResult.rows[0] as ConsentTokenRecord | undefined;

    if (!tokenRecord) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired consent link' } });
    }

    // Exponential backoff cooldown check (before attempting verification)
    // cooldownSeconds = failed_attempts === 0 ? 0 : Math.min(2 ** failed_attempts, 60)
    const failedAttempts = tokenRecord.failed_attempts ?? 0;
    const cooldownSeconds = failedAttempts === 0 ? 0 : Math.min(2 ** failedAttempts, 60);

    if (cooldownSeconds > 0 && tokenRecord.last_attempt_at) {
      const lastAttempt = new Date(tokenRecord.last_attempt_at).getTime();
      const cooldownEnd = lastAttempt + cooldownSeconds * 1000;
      const now = Date.now();

      if (now < cooldownEnd) {
        const retryAfter = Math.ceil((cooldownEnd - now) / 1000);
        await client.query('ROLLBACK');
        transactionStarted = false;
        return res.status(429).json({
          error: {
            code: 'KBV_COOLDOWN',
            message: 'Too many failed attempts. Please wait before trying again.',
            details: { retry_after_seconds: retryAfter },
          },
        });
      }
    }

    // Real verification attempt - update last_attempt_at
    await client.query(
      'UPDATE consent_tokens SET last_attempt_at = NOW() WHERE token = $1',
      [req.params.token]
    );

    if (!datesMatch(date_of_birth, tokenRecord.date_of_birth)) {
      const failedAttemptResult = await client.query(
        [
          'UPDATE consent_tokens',
          'SET failed_attempts = failed_attempts + 1,',
          'expires_at = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() ELSE expires_at END',
          'WHERE token = $1',
          'RETURNING failed_attempts',
        ].join('\n'),
        [req.params.token]
      );
      const newFailedAttempts = failedAttemptResult.rows[0]?.failed_attempts as number | undefined;

      // Audit log: failed attempt
      await client.query(
        [
          'INSERT INTO consent_verification_attempts (token, student_id, ip_address, success, failed_attempts_at_time)',
          'VALUES ($1, $2, $3, FALSE, $4)',
        ].join('\n'),
        [req.params.token, tokenRecord.student_id, req.ip, newFailedAttempts ?? failedAttempts + 1]
      );

      await client.query('COMMIT');
      transactionStarted = false;

      if (newFailedAttempts !== undefined && newFailedAttempts >= 5) {
        return res.status(429).json({ error: { code: 'KBV_ATTEMPTS_EXCEEDED', message: 'Too many verification attempts. Request a new consent email.' } });
      }

      return res.status(400).json({
        error: {
          code: 'KBV_FAILED',
          message: 'Date of birth could not be verified',
          details: { attempts_remaining: Math.max(0, 5 - (newFailedAttempts ?? 0)) },
        },
      });
    }

    // Verification succeeded - audit log: successful attempt
    await client.query(
      [
        'INSERT INTO consent_verification_attempts (token, student_id, ip_address, success, failed_attempts_at_time)',
        'VALUES ($1, $2, $3, TRUE, $4)',
      ].join('\n'),
      [req.params.token, tokenRecord.student_id, req.ip, failedAttempts]
    );

    // Determine parent_id: use token's parent_id if set, otherwise look up by email
    // If no parent account exists yet, create a minimal one
    let parentId = tokenRecord.parent_id;
    if (!parentId && tokenRecord.email) {
      // tokenRecord.email may be plaintext (from request-unverified) or encrypted (legacy consent/link)
      const tokenEmail = isEncrypted(tokenRecord.email) ? decryptPII(tokenRecord.email) : tokenRecord.email;
      const parentLookup = await client.query(
        'SELECT id FROM users WHERE email_hash = $1 AND role = \'parent\' AND deleted_at IS NULL',
        [hashEmail(tokenEmail)]
      );
      if (parentLookup.rows.length > 0) {
        parentId = parentLookup.rows[0].id;
      } else {
        // Auto-create minimal parent account with password reset token
        const resetToken = randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        const encryptedParentEmail = encryptUserPII({ email: tokenEmail }).email;
        const parentEmailHash = hashEmail(tokenEmail);
        const newParentResult = await client.query(
          [
            'INSERT INTO users (email, password_hash, role, display_name, password_reset_token, password_reset_expires, email_hash)',
            'VALUES ($1, $2, \'parent\', $3, $4, $5, $6)',
            'RETURNING id',
          ].join('\n'),
          [encryptedParentEmail, await bcrypt.hash(randomBytes(32).toString('hex'), 12), 'Parent', resetToken, resetExpires, parentEmailHash]
        );
        parentId = newParentResult.rows[0].id;

        // Send password reset email after transaction commits
        // We'll do this after the commit by queuing it
        await sendPasswordResetEmail(tokenEmail, resetToken);
      }
    }

    if (!parentId) {
      throw new Error('Unable to determine parent for consent token');
    }

    // Create parent-student link if it doesn't exist
    await client.query(
      [
        'INSERT INTO parent_student_links (parent_id, student_id)',
        'VALUES ($1, $2)',
        'ON CONFLICT (parent_id, student_id) DO NOTHING',
      ].join('\n'),
      [parentId, tokenRecord.student_id]
    );

    // Grant consent
    const consentResult = await client.query(
      [
        'UPDATE parent_student_links',
        'SET consent_granted = TRUE, consent_date = NOW(), consent_ip = $1,',
        'withdrawn_at = NULL, hard_delete_at = NULL',
        'WHERE parent_id = $2 AND student_id = $3',
        'RETURNING consent_granted, consent_date',
      ].join('\n'),
      [req.ip, parentId, tokenRecord.student_id]
    );
    const consentStatus = consentResult.rows[0] as ConsentStatus | undefined;

    if (!consentStatus) {
      throw new Error('Parent-student link missing for consent token');
    }

    await client.query(
      'UPDATE consent_tokens SET used_at = NOW() WHERE token = $1',
      [req.params.token]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    res.json({ consent_granted: consentStatus.consent_granted, consent_date: consentStatus.consent_date });
  } catch (err) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    console.error('Failed to confirm parental consent.', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  } finally {
    client.release();
  }
});

// POST /api/v1/consent/:linkId/renew
// Send a new consent email for renewal (when consent is expiring or expired)
router.post('/:linkId/renew', authenticate, requireRole(['parent', 'admin']), async (req: AuthRequest, res: Response) => {
  const { linkId } = req.params;

  if (typeof linkId !== 'string' || !isUuid(linkId)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid consent link ID' } });
  }

  try {
    // Verify the link belongs to this parent
    const linkResult = await query(
      [
        'SELECT link.id, link.parent_id, link.student_id, parent.email AS parent_email, student.display_name AS student_name, link.consent_granted, link.withdrawn_at',
        'FROM parent_student_links link',
        'JOIN users parent ON parent.id = link.parent_id',
        'JOIN users student ON student.id = link.student_id',
        'WHERE link.id = $1 AND link.parent_id = $2',
        'AND student.deleted_at IS NULL AND parent.deleted_at IS NULL',
      ].join('\n'),
      [linkId, req.user!.id]
    );
    const link = linkResult.rows[0] as {
      id: string;
      parent_id: string;
      student_id: string;
      parent_email: string;
      student_name: string;
      consent_granted: boolean;
      withdrawn_at: string | Date | null;
    } | undefined;

    if (!link) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Consent link not found' } });
    }

    // Invalidate any existing unused consent tokens
    await query(
      [
        'UPDATE consent_tokens',
        'SET expires_at = NOW()',
        'WHERE student_id = $1 AND parent_id = $2 AND used_at IS NULL',
      ].join('\n'),
      [link.student_id, link.parent_id]
    );

    // Issue new consent token
    const renewToken = await issueConsentToken(link.parent_id, link.student_id, link.parent_email, link.student_name);
    let emailSent = true;
    try {
      await sendConsentEmail(link.parent_email, renewToken, link.student_name);
    } catch (emailErr) {
      console.error('[Consent] Renewal email delivery failed:', emailErr);
      emailSent = false;
    }

    res.json({ consent_renewal_email_sent: emailSent });
  } catch {
    console.error('Failed to send consent renewal email.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

// GET /api/v1/consent/expiring
// List consents expiring within 30 days (for parent dashboard notification)
router.get('/expiring', authenticate, requireRole(['parent', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      [
        'SELECT link.id, link.student_id, student.display_name, link.consent_date,',
        "link.consent_date + INTERVAL '365 days' AS expires_at,",
        'link.consent_granted, link.withdrawn_at',
        'FROM parent_student_links link',
        'JOIN users student ON student.id = link.student_id',
        'WHERE link.parent_id = $1',
        'AND link.consent_granted = TRUE',
        'AND link.withdrawn_at IS NULL',
        "AND link.consent_date + INTERVAL '365 days' <= NOW() + INTERVAL '30 days'",
        'AND student.deleted_at IS NULL',
        'ORDER BY link.consent_date ASC',
      ].join('\n'),
      [req.user!.id]
    );

    res.json({ expiringConsents: result.rows });
  } catch {
    console.error('Failed to fetch expiring consents.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
  }
});

export default router;

async function issueConsentToken(parentId: string | null, studentId: string, parentEmail: string, studentName: string): Promise<string> {
  const token = randomBytes(32).toString('hex');

  await query(
    [
      'INSERT INTO consent_tokens (token, parent_id, student_id, email, expires_at)',
      "VALUES ($1, $2, $3, $4, NOW() + INTERVAL '48 hours')",
    ].join('\n'),
    [token, parentId, studentId, parentEmail]
  );

  return token;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function datesMatch(submittedDate: string, storedDate: string | Date | null): boolean {
  if (typeof storedDate === 'string') {
    return submittedDate === storedDate;
  }

  if (storedDate instanceof Date) {
    const year = storedDate.getFullYear();
    const month = String(storedDate.getMonth() + 1).padStart(2, '0');
    const day = String(storedDate.getDate()).padStart(2, '0');
    return submittedDate === `${year}-${month}-${day}`;
  }

  return false;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
