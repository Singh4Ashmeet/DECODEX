import { Pool } from 'pg';
import dotenv from 'dotenv';
import { encryptUserPII, decryptUserPII, isEncrypted } from '../services/piiEncryption';

dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/decodex';

const hasSsl = Boolean(
  dbUrl.includes('sslmode=require') ||
  dbUrl.includes('supabase.co') ||
  dbUrl.includes('neon.tech') ||
  dbUrl.includes('render.com') ||
  dbUrl.includes('railway.app') ||
  process.env.NODE_ENV === 'production'
);

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: hasSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error on idle client:', err.message);
});

function isUserTableQuery(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return normalized.includes('FROM USERS') || 
         normalized.includes('JOIN USERS') ||
         normalized.includes('INSERT INTO USERS') ||
         normalized.includes('UPDATE USERS');
}

function shouldEncryptFields(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  return normalized.startsWith('INSERT INTO USERS') || 
         normalized.startsWith('UPDATE USERS');
}

function transformUserRow(row: any): any {
  if (!row) return row;
  return decryptUserPII(row);
}

function transformUserRows(rows: any[]): any[] {
  return rows.map(transformUserRow);
}

function encryptParams(text: string, params: any[]): any[] {
  if (!shouldEncryptFields(text) || !params || params.length === 0) {
    return params;
  }
  
  // For INSERT/UPDATE on users, we need to encrypt PII fields in the params
  // This is a simplified approach - in production, you'd want to match params to column names
  // For now, we'll rely on the application layer to encrypt before calling query
  return params;
}

export const query = async (text: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, encryptParams(text, params || []));
    
    // Decrypt PII fields for user table queries
    if (isUserTableQuery(text) && result.rows.length > 0) {
      result.rows = transformUserRows(result.rows);
    }
    
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  } finally {
    client.release();
  }
};