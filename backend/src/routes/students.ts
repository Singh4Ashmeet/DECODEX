import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getConsentStatus } from '../middleware/consent';
import { decryptPII, isEncrypted } from '../services/piiEncryption';

const router = Router();

// Validation schema for reading preferences
const ReadingPreferencesSchema = z.object({
  fontScale: z.number().min(0.85).max(1.5),
  lineSpacing: z.number().min(1).max(2),
  letterSpacing: z.number().min(0).max(0.05),
});

type ReadingPreferences = z.infer<typeof ReadingPreferencesSchema>;

const DEFAULT_PREFERENCES: ReadingPreferences = {
  fontScale: 1,
  lineSpacing: 1,
  letterSpacing: 0,
};

// GET /api/v1/students/me/reading-preferences
router.get('/me/reading-preferences', authenticate, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT reading_preferences FROM users WHERE id = $1 AND role = $2 AND deleted_at IS NULL',
      [req.user!.id, 'student']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student account not found' } });
    }

    const prefs = result.rows[0].reading_preferences;
    res.json({ preferences: prefs ?? DEFAULT_PREFERENCES });
  } catch {
    console.error('Failed to fetch reading preferences.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reading preferences' } });
  }
});

// PUT /api/v1/students/me/reading-preferences
router.put('/me/reading-preferences', authenticate, async (req: AuthRequest, res) => {
  const parseResult = ReadingPreferencesSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid reading preferences',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
  }

  const prefs: ReadingPreferences = parseResult.data;

  try {
    const result = await query(
      `UPDATE users SET reading_preferences = $1, updated_at = NOW() WHERE id = $2 AND role = $3 AND deleted_at IS NULL RETURNING reading_preferences`,
      [JSON.stringify(prefs), req.user!.id, 'student']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student account not found' } });
    }

    res.json({ preferences: result.rows[0].reading_preferences });
  } catch {
    console.error('Failed to update reading preferences.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update reading preferences' } });
  }
});

// GET /api/v1/students/me/consent-status
router.get('/me/consent-status', authenticate, async (req: AuthRequest, res) => {
  try {
    const studentResult = await query(
      'SELECT invite_code FROM users WHERE id = $1 AND role = $2 AND deleted_at IS NULL',
      [req.user!.id, 'student']
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Student account not found' } });
    }

    let inviteCode = studentResult.rows[0].invite_code;
    
    if (!inviteCode) {
      inviteCode = randomBytes(3).toString('hex').toUpperCase();
      await query('UPDATE users SET invite_code = $1 WHERE id = $2', [inviteCode, req.user!.id]);
    }

    const pendingLinkResult = await query(
      [
        'SELECT parent.display_name AS pending_parent_name, parent.email AS pending_parent_email',
        'FROM parent_student_links link',
        'JOIN users parent ON parent.id = link.parent_id',
        'WHERE link.student_id = $1 AND link.consent_granted = FALSE AND link.withdrawn_at IS NULL AND parent.deleted_at IS NULL',
        'LIMIT 1',
      ].join('\n'),
      [req.user!.id]
    );
    const pendingParent = pendingLinkResult.rows[0] as { pending_parent_name: string; pending_parent_email: string } | undefined;

    const consentStatus = await getConsentStatus(req.user!.id);
    res.json({
      invite_code: inviteCode,
      ...consentStatus,
      pending_parent_name: pendingParent?.pending_parent_name
        ? (isEncrypted(pendingParent.pending_parent_name) ? decryptPII(pendingParent.pending_parent_name) : pendingParent.pending_parent_name)
        : null,
      pending_parent_email: pendingParent?.pending_parent_email
        ? (isEncrypted(pendingParent.pending_parent_email) ? decryptPII(pendingParent.pending_parent_email) : pendingParent.pending_parent_email)
        : null,
    });
  } catch {
    console.error('Failed to fetch consent status.');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch consent status' } });
  }
});

export default router;
