#!/usr/bin/env node
/**
 * One-time Render Shell script: Fix the Ashmeet Singh production account.
 *
 * What it does:
 *   1. Finds the user by email (ashmeet0409singh@gmail.com)
 *   2. Shows the current role and email_hash state
 *   3. Updates role to 'parent' if it isn't already
 *   4. Backfills email_hash if it's NULL
 *   5. Shows the after state
 *
 * Usage (Render Shell):
 *   cd backend && node scripts/fix-ashmeet-account.js
 *
 * Safe to run multiple times — idempotent.
 * Requires PII_ENCRYPTION_KEY and DATABASE_URL in the environment (Render has both).
 */
const { Pool } = require('pg');
const crypto = require('crypto');

// --- Configuration ---
const TARGET_EMAIL = 'ashmeet0409singh@gmail.com';
const CORRECT_ROLE = 'parent';

// --- Helpers (replicated from piiEncryption.ts to avoid TS compilation) ---
function getEncryptionKey() {
  const keyB64 = process.env.PII_ENCRYPTION_KEY;
  if (!keyB64) throw new Error('PII_ENCRYPTION_KEY not set');
  return Buffer.from(keyB64, 'base64');
}

function hashEmail(email) {
  const key = getEncryptionKey();
  return crypto.createHmac('sha256', key).update(email.toLowerCase().trim()).digest('hex');
}

function decryptPII(encrypted) {
  if (!encrypted || !encrypted.includes(':')) return encrypted;
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function isEncrypted(value) {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const emailHash = hashEmail(TARGET_EMAIL);

  console.log('=== Fix Ashmeet Singh Production Account ===');
  console.log(`Target email: ${TARGET_EMAIL}`);
  console.log(`Email hash: ${emailHash}`);

  // Step 1: Find the account
  console.log('\n--- Step 1: Find account ---');
  const findResult = await pool.query(
    'SELECT id, email, email_hash, role, display_name, deleted_at FROM users WHERE email_hash = $1',
    [emailHash]
  );

  if (findResult.rows.length === 0) {
    // Try fallback: scan for encrypted email match
    console.log('email_hash lookup found nothing. Scanning for encrypted email match...');
    const scanResult = await pool.query(
      "SELECT id, email, email_hash, role, display_name, deleted_at FROM users WHERE email_hash IS NULL AND deleted_at IS NULL"
    );
    let found = null;
    for (const row of scanResult.rows) {
      try {
        const decrypted = isEncrypted(row.email) ? decryptPII(row.email) : row.email;
        if (decrypted.toLowerCase().trim() === TARGET_EMAIL.toLowerCase().trim()) {
          found = row;
          break;
        }
      } catch { /* skip corrupt rows */ }
    }
    if (!found) {
      console.error(`\nERROR: No user found with email "${TARGET_EMAIL}" (neither by hash nor by decryption scan).`);
      console.error('If this account was soft-deleted, check with: SELECT * FROM users WHERE email LIKE \'%ashmeet%\'');
      await pool.end();
      process.exit(1);
    }
    console.log(`Found via decryption scan: id=${found.id}`);
    await fixAccount(pool, found, emailHash);
  } else {
    const user = findResult.rows[0];
    console.log(`Found via email_hash: id=${user.id}`);
    await fixAccount(pool, user, emailHash);
  }

  await pool.end();
  console.log('\n=== Done ===');
}

async function fixAccount(pool, user, emailHash) {
  // Step 2: Show current state
  console.log('\n--- Step 2: Current state ---');
  console.log(`  id:          ${user.id}`);
  console.log(`  role:        ${user.role}`);
  console.log(`  email_hash:  ${user.email_hash || '(NULL)'}`);
  console.log(`  display_name: ${user.display_name}`);
  console.log(`  deleted_at:  ${user.deleted_at || '(active)'}`);

  if (user.deleted_at) {
    console.error('\nWARNING: This account is soft-deleted. Un-deleting is not done by this script.');
    console.error('The role/email_hash fixes below will still run, but the account won\'t be usable until undeleted.');
  }

  // Step 3: Fix role
  let roleFixed = false;
  if (user.role !== CORRECT_ROLE) {
    console.log(`\n--- Step 3: Fix role: "${user.role}" → "${CORRECT_ROLE}" ---`);
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [CORRECT_ROLE, user.id]);
    roleFixed = true;
    console.log('  ✓ Role updated');
  } else {
    console.log(`\n--- Step 3: Role already correct ("${user.role}") — no change needed ---`);
  }

  // Step 4: Backfill email_hash
  let hashFixed = false;
  if (!user.email_hash) {
    console.log(`\n--- Step 4: Backfill email_hash ---`);
    await pool.query('UPDATE users SET email_hash = $1 WHERE id = $2', [emailHash, user.id]);
    hashFixed = true;
    console.log('  ✓ email_hash populated');
  } else {
    console.log(`\n--- Step 4: email_hash already present — no change needed ---`);
  }

  // Step 5: Verify final state
  if (roleFixed || hashFixed) {
    console.log('\n--- Step 5: Verify final state ---');
    const verifyResult = await pool.query(
      'SELECT id, email_hash, role FROM users WHERE id = $1',
      [user.id]
    );
    const updated = verifyResult.rows[0];
    console.log(`  id:          ${updated.id}`);
    console.log(`  role:        ${updated.role} ${updated.role === CORRECT_ROLE ? '✓' : '✗ MISMATCH'}`);
    console.log(`  email_hash:  ${updated.email_hash ? updated.email_hash.substring(0, 16) + '...' : '(NULL)'} ${updated.email_hash ? '✓' : '✗ STILL NULL'}`);

    // Step 6: Verify login works (test hash lookup)
    console.log('\n--- Step 6: Verify login lookup would work ---');
    const loginLookup = await pool.query(
      'SELECT id, role FROM users WHERE email_hash = $1 AND deleted_at IS NULL',
      [emailHash]
    );
    if (loginLookup.rows.length > 0) {
      console.log(`  ✓ email_hash lookup finds user with role="${loginLookup.rows[0].role}"`);
    } else {
      console.log('  ✗ email_hash lookup returns nothing — login would fail');
    }
  } else {
    console.log('\nNo changes needed — account is already correct.');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
