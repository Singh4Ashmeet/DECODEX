/**
 * MFA (TOTP) Service — Time-based One-Time Password for teacher/admin accounts
 * 
 * Uses otplib v12+ for RFC 6238 compliant TOTP generation/verification
 * Recovery codes: 10 single-use codes, bcrypt hashed
 */
import { 
  generateSecret, 
  keyuri, 
  check,
  generate 
} from 'otplib';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export interface MFASetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
}

export interface MFAVerificationResult {
  valid: boolean;
  recoveryCodeUsed?: boolean;
}

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 8;

/**
 * Generate a new TOTP secret and OTPAuth URL for QR code
 */
export function generateMFASecret(userEmail: string, issuer = 'Decodex'): { secret: string; otpauthUrl: string } {
  const secret = generateSecret();
  const otpauthUrl = keyuri(userEmail, issuer, secret);
  return { secret, otpauthUrl };
}

/**
 * Generate QR code as data URL (base64 PNG)
 */
export async function generateQRCodeDataUrl(otpauthUrl: string): Promise<string> {
  // Use a simple QR code generation approach
  // In production, you might use 'qrcode' package
  const qrCodeResponse = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`);
  const buffer = await qrCodeResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * Generate recovery codes (plaintext for user, hashed for storage)
 */
export function generateRecoveryCodes(): { plaintext: string[]; hashed: string[] } {
  const plaintext: string[] = [];
  const hashed: string[] = [];
  
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // Format: XXXX-XXXX
    const code = randomBytes(RECOVERY_CODE_LENGTH / 2).toString('hex').toUpperCase();
    const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}`;
    plaintext.push(formatted);
    hashed.push(bcrypt.hashSync(formatted, 12));
  }
  
  return { plaintext, hashed };
}

/**
 * Verify a TOTP token
 */
export function verifyTOTP(token: string, secret: string): boolean {
  try {
    return check(token, secret);
  } catch {
    return false;
  }
}

/**
 * Verify a recovery code
 */
export async function verifyRecoveryCode(code: string, hashedCodes: string[]): Promise<{ valid: boolean; remainingCodes: string[] }> {
  const normalizedCode = code.toUpperCase().replace(/-/g, '');
  
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(normalizedCode, hashedCodes[i]);
    if (match) {
      // Remove used code
      const remaining = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
      return { valid: true, remainingCodes: remaining };
    }
  }
  
  return { valid: false, remainingCodes: hashedCodes };
}

/**
 * Generate current TOTP token (for testing/admin)
 */
export function generateCurrentTOTP(secret: string): string {
  return generate(secret);
}

/**
 * Check if MFA is required for a role
 */
export function isMFARequired(role: string): boolean {
  return role === 'teacher' || role === 'admin';
}

/**
 * MFA Setup flow result for API response
 */
export interface MFASetupResponse {
  secret: string;
  qrCodeDataUrl: string;
  recoveryCodes: string[];
  backupInstruction: string;
}