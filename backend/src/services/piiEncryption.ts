/**
 * PII Encryption Service — Application-level encryption for sensitive user data
 * 
 * Encrypts: users.email, users.display_name, users.date_of_birth
 * Uses AES-256-GCM with key from environment variable
 */
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits

// Encryption key from environment (base64 encoded)
function getEncryptionKey(): Buffer {
  const keyB64 = process.env.PII_ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error('PII_ENCRYPTION_KEY environment variable is required');
  }
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`PII_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (base64 encoded)`);
  }
  return key;
}

/**
 * Encrypt a plaintext string
 * Returns base64 encoded: iv:ciphertext:tag
 */
export function encryptPII(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Format: iv:ciphertext:tag (all base64)
  return [
    iv.toString('base64'),
    ciphertext.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

/**
 * Decrypt a PII string
 * Expects format: iv:ciphertext:tag (all base64)
 */
export function decryptPII(encrypted: string): string {
  if (!encrypted) return encrypted;
  
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    // Not encrypted (legacy data) - return as-is
    return encrypted;
  }
  
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'base64');
  const ciphertext = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  
  return plaintext.toString('utf8');
}

/**
 * Check if a string appears to be encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

/**
 * Fields that should be encrypted
 */
export const PII_FIELDS = [
  'email',
  'display_name',
  'date_of_birth',
] as const;

export type PIIField = typeof PII_FIELDS[number];

/**
 * Encrypt PII fields in a user object
 */
export function encryptUserPII(user: Record<string, any>): Record<string, any> {
  const encrypted = { ...user };
  for (const field of PII_FIELDS) {
    if (encrypted[field] && typeof encrypted[field] === 'string' && !isEncrypted(encrypted[field])) {
      encrypted[field] = encryptPII(encrypted[field]);
    }
  }
  return encrypted;
}

/**
 * Decrypt PII fields in a user object
 */
export function decryptUserPII(user: Record<string, any>): Record<string, any> {
  const decrypted = { ...user };
  for (const field of PII_FIELDS) {
    if (decrypted[field] && typeof decrypted[field] === 'string' && isEncrypted(decrypted[field])) {
      decrypted[field] = decryptPII(decrypted[field]);
    }
  }
  return decrypted;
}

/**
 * Generate a new encryption key (for initial setup)
 * Run once and store in environment: openssl rand -base64 32
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}