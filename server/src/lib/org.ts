import { query } from '../config/database';

// Shared organisation helpers used by both self-service registration and the
// platform-admin provisioning console.

// A short, unique numeric code a member types on WhatsApp/USSD to enrol under
// this organisation. Retries on the rare collision, widening to 8 digits as a
// last resort.
export async function generateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const clash = await query('SELECT 1 FROM organisations WHERE join_code = $1', [code]);
    if (clash.rows.length === 0) return code;
  }
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Produces a slug that is unique in the organisations table, appending -2, -3 …
// until a free one is found (so admins never hit a "name taken" wall).
export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'org';
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await query('SELECT 1 FROM organisations WHERE slug = $1', [candidate]);
    if (exists.rows.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}
