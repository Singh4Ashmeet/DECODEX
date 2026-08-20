import dotenv from 'dotenv';
dotenv.config();

import readline from 'readline';
import { query, pool } from '../db';

const PRODUCTION_HOSTS = ['render.com', 'supabase.co', 'neon.tech', 'railway.app'];

type DatabaseEnv = 'production' | 'unknown-remote' | 'local';

function getDatabaseEnvironment(): DatabaseEnv {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    return 'production';
  }

  if (PRODUCTION_HOSTS.some((host) => dbUrl.includes(host))) {
    return 'production';
  }

  // If not explicitly local, consider it unknown-remote (potentially a production DB not in our allowlist)
  if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('host.docker.internal')) {
    return 'unknown-remote';
  }

  return 'local';
}

/**
 * Tables that hold user-generated data, sourced from backend/src/db/schema.sql and migrations.
 * Listed in FK-safe order (children before parents).
 *
 * DECISION ON 'schools': Truncated. Since the goal is a genuinely empty state where
 * everyone must register fresh, preserving schools could leave orphaned references if real
 * teachers/admins had set them up. Truncating schools aligns with the "clean slate" goal.
 *
 * NOTE: 'passages' and 'achievements' are intentionally excluded — they hold seed /
 * reference data that is not user-generated.
 */
function getTableList(): string[] {
  return [
    // Deepest children first
    'failed_jobs',                   // references reading_sessions (SET NULL) (v8)
    'consent_verification_attempts', // references users (CASCADE) (v7)
    'teacher_student_links',         // references users (CASCADE) (v12)
    'behavioral_metrics',            // references reading_sessions (CASCADE), users (CASCADE) (v2)
    'copilot_sessions',              // references users (CASCADE) (v2)
    'iep_documents',                 // references users (CASCADE) (v2)
    'student_achievements',          // references users (CASCADE) (v2)
    'gamification_profiles',         // references users (CASCADE) (v2)
    'generated_stories',             // references users (CASCADE) (v2)
    'learning_path_weeks',           // references learning_paths (CASCADE) (v2)
    'learning_paths',                // references users (CASCADE) (v2)
    'risk_screenings',               // references users (CASCADE) (v2)
    'health_scores',                 // references users (CASCADE), reading_sessions (SET NULL) (v2)
    'classification_corrections',    // references error_classifications (CASCADE), users (CASCADE) (v1)
    'error_classifications',         // references reading_sessions (CASCADE) (v1)
    'error_profiles',                // references users (CASCADE), reading_sessions (CASCADE) (v1)
    'drills',                        // references reading_sessions (CASCADE), users (CASCADE) (v1)
    'consent_tokens',                // references users (CASCADE) (v1)
    'parent_student_links',          // references users (CASCADE, twice) (v1)
    'reading_sessions',              // references users (CASCADE), passages (no action) (v1)
    'users',                         // references schools (no action) (v1)
    'schools',                       // Base organizational structure, wiped for clean slate (v1)
  ];
}

/**
 * Returns the subset of `tables` that actually exist in the connected database.
 * This guards against non-existent tables causing a fatal TRUNCATE error.
 */
async function filterExistingTables(tables: string[]): Promise<string[]> {
  const placeholders = tables.map((_, i) => `$${i + 1}`).join(', ');
  const result = await query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN (${placeholders})`,
    tables
  );
  const existing = new Set(result.rows.map((r: { table_name: string }) => r.table_name));
  // Preserve the original FK-safe order
  return tables.filter((t) => existing.has(t));
}

async function getRowCounts(tables: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  for (const table of tables) {
    try {
      const result = await query(`SELECT count(*) FROM ${table}`);
      counts.set(table, parseInt(result.rows[0].count, 10));
    } catch (error) {
      // Table might not exist
      counts.set(table, 0);
    }
  }

  return counts;
}

async function truncateTables(tables: string[]): Promise<void> {
  if (tables.length === 0) {
    console.log('No tables to truncate.');
    return;
  }
  // Filter to only tables that actually exist to prevent a fatal PG error.
  const existing = await filterExistingTables(tables);
  if (existing.length === 0) {
    console.log('None of the listed tables exist in the connected database.');
    return;
  }
  const skipped = tables.filter((t) => !existing.includes(t));
  if (skipped.length > 0) {
    console.log(`  (Skipping ${skipped.length} table(s) not yet in schema: ${skipped.join(', ')})`);
  }
  // TRUNCATE … CASCADE handles any remaining FK dependencies automatically.
  const tableList = existing.join(', ');
  await query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

function createPrompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const forceFlag = args.includes('--force');
  const yesFlag = args.includes('--yes');

  console.log('=== Decodex Database Reset Script ===\n');

  const dbEnv = getDatabaseEnvironment();
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/decodex';
  const maskedUrl = dbUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${maskedUrl}`);
  
  if (dbEnv === 'production') {
    console.log(`DB Classification: PRODUCTION (matched allowed host or NODE_ENV=production)\n`);
  } else if (dbEnv === 'unknown-remote') {
    console.log(`DB Classification: UNKNOWN REMOTE (does not look like localhost)\n`);
  } else {
    console.log(`DB Classification: LOCAL DEV\n`);
  }

  if (dbEnv === 'production' || dbEnv === 'unknown-remote') {
    console.log('⚠️  DANGER: REMOTE OR PRODUCTION DATABASE DETECTED ⚠️');
    console.log('This script will DELETE ALL USER DATA.');
    console.log('To proceed, you must:\n');
    console.log('  1. Run with --force flag');
    console.log('  2. Type "DELETE PRODUCTION DATA" at the confirmation prompt\n');

    if (!forceFlag) {
      console.log('ERROR: --force flag is required for remote/production databases.');
      console.log('Run with: npm run reset-db -- --force');
      process.exit(1);
    }

    const confirmation = await createPrompt('Type "DELETE PRODUCTION DATA" to confirm: ');

    if (confirmation !== 'DELETE PRODUCTION DATA') {
      console.log('\nConfirmation text does not match. Aborting.');
      process.exit(1);
    }
  } else {
    // Local/dev: show summary and ask for y/n confirmation
    console.log('This will TRUNCATE all user-generated data tables.');
    console.log('The following tables will be cleared (row counts shown):\n');

    const allTables = getTableList();
    const tables = await filterExistingTables(allTables);
    const counts = await getRowCounts(tables);

    let totalRows = 0;
    for (const [table, count] of counts) {
      console.log(`  ${table}: ${count} rows`);
      totalRows += count;
    }
    console.log(`\n  TOTAL: ~${totalRows} rows across ${tables.length} tables\n`);

    if (!yesFlag) {
      const confirmation = await createPrompt('Proceed? [y/N]: ');
      if (confirmation.toLowerCase() !== 'y' && confirmation.toLowerCase() !== 'yes') {
        console.log('\nAborted.');
        process.exit(0);
      }
    }
  }

  console.log('\nTruncating tables...\n');

  const tables = getTableList();
  const beforeCounts = await getRowCounts(tables);

  try {
    await truncateTables(tables);

    console.log('✅ Tables truncated successfully.\n');

    // Verify counts after truncation
    const afterCounts = await getRowCounts(tables);

    console.log('=== Reset Summary ===');
    let totalRemoved = 0;
    for (const table of tables) {
      const before = beforeCounts.get(table) || 0;
      const after = afterCounts.get(table) || 0;
      const removed = before - after;
      totalRemoved += removed;
      console.log(`  ${table}: ${before} → ${after} (removed ${removed})`);
    }
    console.log(`\nTotal rows removed: ${totalRemoved}`);
    console.log('\nNext steps:');
    console.log('  - Restart the backend server to re-seed demo data (db/init.ts guard)');
    console.log('  - Run: npm run dev (or npm run start:prod for production build)');
  } catch (error) {
    console.error('❌ Error during truncation:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();