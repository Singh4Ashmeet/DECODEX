/**
 * MFA (TOTP) Routes — Teacher/Admin multi-factor authentication
 * 
 * Endpoints:
 * POST /api/v1/mfa/setup — Initiate MFA setup (returns QR code + recovery codes)
 * POST /api/v1/mfa/verify — Verify TOTP token to enable MFA
 * POST /api/v1/mfa/disable — Disable MFA (requires password + TOTP/recovery)
 * POST /api/v1/mfa/recovery-codes — Regenerate recovery codes
 * GET /api/v1/mfa/status — Check MFA status
 */
import { Router, Response } from 'express';
import { query } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { 
  generateMFASecret, 
  generateQRCodeDataUrl, 
  generateRecoveryCodes, 
  verifyTOTP, 
  verifyRecoveryCode,
  isMFARequired 
} from '../services/mfa';
import bcrypt from 'bcrypt';

const router = Router();
const requireTeacherOrAdmin = requireRole(['teacher', 'admin']);

// GET /api/v1/mfa/status
router.get('/status', authenticate, requireTeacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT mfa_enabled, totp_secret IS NOT NULL as has_secret FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    const user = result.rows[0];
    res.json({
      mfa_enabled: user?.mfa_enabled || false,
      mfa_required: isMFARequired(req.user!.role),
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get MFA status' } });
  }
});

// POST /api/v1/mfa/setup
// Initiate MFA setup - returns QR code and recovery codes
router.post('/setup', authenticate, requireTeacherOrAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Check if MFA already enabled
    const existing = await query(
      'SELECT mfa_enabled FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    if (existing.rows[0]?.mfa_enabled) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'MFA already enabled' } });
    }

    // Get user email for OTPAuth URL
    const userResult = await query('SELECT email FROM users WHERE id = $1', [req.user!.id]);
    const email = userResult.rows[0]?.email;
    
    if (!email) {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'User email not found' } });
    }

    // Generate secret and QR code
    const { secret, otpauthUrl } = generateMFASecret(email);
    const qrCodeDataUrl = await generateQRCodeDataUrl(otpauthUrl);
    const { plaintext: recoveryCodes, hashed } = generateRecoveryCodes();

    // Store secret and recovery codes (not enabled yet)
    await query(
      'UPDATE users SET totp_secret = $1, mfa_recovery_codes = $2, updated_at = NOW() WHERE id = $3',
      [secret, hashed, req.user!.id]
    );

    res.json({
      secret,
      qrCodeDataUrl,
      recoveryCodes,
      backupInstruction: 'Save these recovery codes in a secure place. Each code can be used once if you lose access to your authenticator app.',
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate MFA setup' } });
  }
});

// POST /api/v1/mfa/verify
// Verify TOTP token to enable MFA
router.post('/verify', authenticate, requireTeacherOrAdmin, async (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  
  if (!token || typeof token !== 'string' || token.length !== 6) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid 6-digit TOTP token required' } });
  }

  try {
    const userResult = await query(
      'SELECT totp_secret, mfa_enabled FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    const user = userResult.rows[0];
    
    if (!user?.totp_secret) {
      return res.status(400).json({ error: { code: 'INVALID_STATE', message: 'MFA setup not initiated' } });
    }
    
    if (user.mfa_enabled) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'MFA already enabled' } });
    }

    const valid = verifyTOTP(token, user.totp_secret);
    
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid TOTP token' } });
    }

    // Enable MFA
    await query(
      'UPDATE users SET mfa_enabled = TRUE, updated_at = NOW() WHERE id = $1',
      [req.user!.id]
    );

    res.json({ 
      mfa_enabled: true,
      message: 'MFA enabled successfully' 
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to verify MFA token' } });
  }
});

// POST /api/v1/mfa/disable
// Disable MFA (requires password + TOTP or recovery code)
router.post('/disable', authenticate, requireTeacherOrAdmin, async (req: AuthRequest, res: Response) => {
  const { password, token, recoveryCode } = req.body;
  
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Password required' } });
  }
  
  if ((!token && !recoveryCode) || (token && recoveryCode)) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide either TOTP token or recovery code, not both' } });
  }

  try {
    const userResult = await query(
      'SELECT password_hash, totp_secret, mfa_enabled, mfa_recovery_codes FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    const user = userResult.rows[0];
    
    if (!user?.mfa_enabled) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'MFA not enabled' } });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid password' } });
    }

    // Verify second factor
    let secondFactorValid = false;
    
    if (token) {
      if (typeof token !== 'string' || token.length !== 6) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid 6-digit TOTP token required' } });
      }
      secondFactorValid = verifyTOTP(token, user.totp_secret);
    } else if (recoveryCode) {
      const { valid, remainingCodes } = await verifyRecoveryCode(recoveryCode, user.mfa_recovery_codes || []);
      secondFactorValid = valid;
      if (valid) {
        // Update recovery codes (remove used one)
        await query(
          'UPDATE users SET mfa_recovery_codes = $1 WHERE id = $2',
          [remainingCodes, req.user!.id]
        );
      }
    }

    if (!secondFactorValid) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid TOTP token or recovery code' } });
    }

    // Disable MFA
    await query(
      'UPDATE users SET mfa_enabled = FALSE, totp_secret = NULL, mfa_recovery_codes = NULL, updated_at = NOW() WHERE id = $1',
      [req.user!.id]
    );

    res.json({ 
      mfa_enabled: false,
      message: 'MFA disabled successfully' 
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to disable MFA' } });
  }
});

// POST /api/v1/mfa/recovery-codes
// Regenerate recovery codes (requires TOTP verification)
router.post('/recovery-codes', authenticate, requireTeacherOrAdmin, async (req: AuthRequest, res: Response) => {
  const { token } = req.body;
  
  if (!token || typeof token !== 'string' || token.length !== 6) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid 6-digit TOTP token required' } });
  }

  try {
    const userResult = await query(
      'SELECT totp_secret, mfa_enabled FROM users WHERE id = $1',
      [req.user!.id]
    );
    
    const user = userResult.rows[0];
    
    if (!user?.mfa_enabled) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'MFA not enabled' } });
    }

    const valid = verifyTOTP(token, user.totp_secret);
    
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid TOTP token' } });
    }

    // Generate new recovery codes
    const { plaintext: recoveryCodes, hashed } = generateRecoveryCodes();

    await query(
      'UPDATE users SET mfa_recovery_codes = $1, updated_at = NOW() WHERE id = $2',
      [hashed, req.user!.id]
    );

    res.json({
      recoveryCodes,
      backupInstruction: 'Save these new recovery codes. Previous codes are now invalid.',
    });
  } catch (error) {
    console.error('MFA recovery codes error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to regenerate recovery codes' } });
  }
});

export default router;