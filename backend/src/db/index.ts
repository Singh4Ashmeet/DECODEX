import { Pool } from 'pg';
import dotenv from 'dotenv';

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

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
