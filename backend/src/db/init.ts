import fs from 'fs';
import path from 'path';
import type { PoolClient } from 'pg';
import { pool } from './index';
import { hashEmail, decryptPII, isEncrypted } from '../services/piiEncryption';

const MIGRATION_LOCK_KEY = 752021993;
const DEFAULT_DB_INIT_ATTEMPTS = 5;
const DEFAULT_DB_INIT_BASE_DELAY_MS = 1000;
const DEFAULT_DB_INIT_MAX_DELAY_MS = 10000;

type Queryable = Pick<PoolClient, 'query'>;

interface InitRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
}

export const initDB = async () => {
  let client: PoolClient | undefined;
  let lockAcquired = false;

  try {
    client = await pool.connect();
    console.log('Waiting for database migration advisory lock...');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    lockAcquired = true;
    console.log('Database migration advisory lock acquired.');

    await applySchemaMigrationsAndSeed(client);
  } catch (error) {
    console.error('Error during DB init:', error);
    throw error;
  } finally {
    if (client) {
      if (lockAcquired) {
        try {
          await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
          console.log('Database migration advisory lock released.');
        } catch (unlockError) {
          console.error('Failed to release database migration advisory lock:', unlockError);
        }
      }
      client.release();
    }
  }
};

export const initDBWithRetry = async (options: InitRetryOptions = {}) => {
  const attempts = options.attempts ?? getPositiveIntEnv('DB_INIT_MAX_ATTEMPTS', DEFAULT_DB_INIT_ATTEMPTS);
  const baseDelayMs = options.baseDelayMs ?? getPositiveIntEnv('DB_INIT_RETRY_BASE_MS', DEFAULT_DB_INIT_BASE_DELAY_MS);
  const maxDelayMs = options.maxDelayMs ?? getPositiveIntEnv('DB_INIT_RETRY_MAX_MS', DEFAULT_DB_INIT_MAX_DELAY_MS);
  const label = options.label ?? 'Database initialization';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await initDB();
      return;
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }

      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      console.error(`${label} failed on attempt ${attempt}/${attempts}. Retrying in ${delayMs}ms.`, error);
      await sleep(delayMs);
    }
  }
};

async function applySchemaMigrationsAndSeed(client: Queryable) {
    // Schema uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS throughout,
    // so it is fully idempotent and safe to run on every container start.
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schema);
    console.log('Schema V1 applied successfully (idempotent).');

    // Apply V2 Migration (Health Scores, Risk Screenings, Learning Paths, Copilot, Gamification, IEPs, Stories)
    const migrationV2Path = path.join(__dirname, 'migration_v2.sql');
    if (fs.existsSync(migrationV2Path)) {
      const migration = fs.readFileSync(migrationV2Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V2 applied successfully (idempotent).');
    }

    // Apply V3 Migration (Multi-Language Support: preferred_language on users)
    const migrationV3Path = path.join(__dirname, 'migration_v3.sql');
    if (fs.existsSync(migrationV3Path)) {
      const migration = fs.readFileSync(migrationV3Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V3 applied successfully (idempotent).');
    }

    // Apply V4 Migration (Streak Freeze Mechanism)
    const migrationV4Path = path.join(__dirname, 'migration_v4.sql');
    if (fs.existsSync(migrationV4Path)) {
      const migration = fs.readFileSync(migrationV4Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V4 applied successfully (idempotent).');
    }

    // Apply V5 Migration (Audio Object Storage)
    const migrationV5Path = path.join(__dirname, 'migration_v5.sql');
    if (fs.existsSync(migrationV5Path)) {
      const migration = fs.readFileSync(migrationV5Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V5 applied successfully (idempotent).');
    }

    // Apply V6 Migration (Drop deprecated audio_base64 and audio_file_path columns)
    const migrationV6Path = path.join(__dirname, 'migration_v6.sql');
    if (fs.existsSync(migrationV6Path)) {
      const migration = fs.readFileSync(migrationV6Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V6 applied successfully (idempotent).');
    }

    // Apply V7 Migration (Harden DOB Knowledge-Based Verification)
    const migrationV7Path = path.join(__dirname, 'migration_v7.sql');
    if (fs.existsSync(migrationV7Path)) {
      const migration = fs.readFileSync(migrationV7Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V7 applied successfully (idempotent).');
    }

    // Apply V8 Migration (Dead-letter table for failed audio processing jobs)
    const migrationV8Path = path.join(__dirname, 'migration_v8.sql');
    if (fs.existsSync(migrationV8Path)) {
      const migration = fs.readFileSync(migrationV8Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V8 applied successfully (idempotent).');
    }

    // Apply V9 Migration (User Reading Preferences)
    const migrationV9Path = path.join(__dirname, 'migration_v9.sql');
    if (fs.existsSync(migrationV9Path)) {
      const migration = fs.readFileSync(migrationV9Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V9 applied successfully (idempotent).');
    }

    // Apply V10 Migration (Demo school backfill for teacher-scoped access)
    const migrationV10Path = path.join(__dirname, 'migration_v10.sql');
    if (fs.existsSync(migrationV10Path)) {
      const migration = fs.readFileSync(migrationV10Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V10 applied successfully (idempotent).');
    }

    // Apply V11 Migration (Teacher assignments + student assignment rewards)
    const migrationV11Path = path.join(__dirname, 'migration_v11.sql');
    if (fs.existsSync(migrationV11Path)) {
      const migration = fs.readFileSync(migrationV11Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V11 applied successfully (idempotent).');
    }

    // Apply V12 Migration (Teacher-Student Links for explicit access control)
    const migrationV12Path = path.join(__dirname, 'migration_v12.sql');
    if (fs.existsSync(migrationV12Path)) {
      const migration = fs.readFileSync(migrationV12Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V12 applied successfully (idempotent).');
    }

    // Apply V13 Migration (Account lockout columns on users table)
    const migrationV13Path = path.join(__dirname, 'migration_v13.sql');
    if (fs.existsSync(migrationV13Path)) {
      const migration = fs.readFileSync(migrationV13Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V13 applied successfully (idempotent).');
    }

    // Apply V14 Migration (email_hash for deterministic email lookup)
    const migrationV14Path = path.join(__dirname, 'migration_v14.sql');
    if (fs.existsSync(migrationV14Path)) {
      const migration = fs.readFileSync(migrationV14Path, 'utf-8');
      await client.query(migration);
      console.log('Migration V14 applied successfully (idempotent).');
    }

    // Backfill email_hash for existing users (runs once per user, then email_hash is set)
    await backfillEmailHashes(client);

    const usersCheck = await client.query('SELECT count(*) FROM users');
    const userCount = parseInt(usersCheck.rows[0].count);
    if (shouldSeedDemoData(userCount)) {
      const seedPath = path.join(__dirname, 'seed.sql');
      const seed = fs.readFileSync(seedPath, 'utf-8');
      await client.query(seed);
      console.log('Database seeded successfully.');
    } else {
      console.log(getSeedSkipMessage(userCount));
    }
}

/**
 * Backfill email_hash for existing users registered before migration V14.
 * Decrypts each user's PII-encrypted email, computes HMAC-SHA256 hash,
 * and updates the email_hash column. Idempotent — skips users that already
 * have an email_hash. Runs in batches of 100 for efficiency.
 */
async function backfillEmailHashes(client: Queryable) {
  try {
    const result = await client.query(
      "SELECT id, email FROM users WHERE email_hash IS NULL AND deleted_at IS NULL"
    );
    const users = result.rows;
    if (users.length === 0) {
      console.log('Email hash backfill: all users already have email_hash.');
      return;
    }

    console.log(`Email hash backfill: ${users.length} user(s) need backfilling...`);

    let backfilled = 0;
    let skipped = 0;
    const BATCH_SIZE = 100;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      for (const user of batch) {
        try {
          const email = isEncrypted(user.email) ? decryptPII(user.email) : user.email;
          if (!email || typeof email !== 'string') {
            skipped++;
            continue;
          }
          const emailHash = hashEmail(email);
          await client.query('UPDATE users SET email_hash = $1 WHERE id = $2', [emailHash, user.id]);
          backfilled++;
        } catch (err: any) {
          skipped++;
          console.warn(`Email hash backfill: skipped user ${user.id} — ${err?.message || 'decrypt failed'}`);
        }
      }
      // Log progress for large datasets
      if (users.length > BATCH_SIZE) {
        console.log(`Email hash backfill: ${Math.min(i + BATCH_SIZE, users.length)}/${users.length} processed...`);
      }
    }

    console.log(`Email hash backfill complete: ${backfilled} backfilled, ${skipped} skipped.`);
  } catch (err: any) {
    // Non-fatal: backfill failure shouldn't block startup.
    // Users with NULL email_hash will be auto-backfilled on their next login
    // via the fallback path in auth.ts.
    console.warn('Email hash backfill failed (non-fatal):', err?.message || err);
  }
}

function shouldSeedDemoData(userCount: number) {
  if (userCount > 0) return false;
  if (process.env.NODE_ENV === 'production') {
    return process.env.SEED_DEMO_DATA === 'true';
  }
  return true;
}

function getSeedSkipMessage(userCount: number) {
  if (userCount > 0) return 'Database already seeded, skipping.';
  if (process.env.NODE_ENV === 'production') {
    return 'Production demo seed skipped. Set SEED_DEMO_DATA=true to seed an empty production database explicitly.';
  }
  return 'Demo seed skipped.';
}

function getPositiveIntEnv(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
