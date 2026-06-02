import { Pool } from 'pg';
import { env } from './env';

// TLS policy for the database connection:
//   - localhost: no TLS (local dev Postgres).
//   - DATABASE_CA_CERT set: verify the server certificate against that CA
//     (strongest — rejects a MITM presenting a different cert).
//   - otherwise: encrypted but unverified (rejectUnauthorized: false). This is
//     the managed-Postgres default (Supabase/Neon) and acceptable for the MVP,
//     but supplying DATABASE_CA_CERT in production is recommended.
function sslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  if (env.databaseUrl.includes('localhost')) return false;
  if (env.databaseCaCert) return { rejectUnauthorized: true, ca: env.databaseCaCert };
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: sslConfig(),
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(1);
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}
