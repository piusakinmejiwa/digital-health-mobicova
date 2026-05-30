import { Pool } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(1);
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
