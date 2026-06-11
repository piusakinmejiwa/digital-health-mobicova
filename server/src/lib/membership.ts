import { query } from '../config/database';

// Membership IDs: a human-friendly identifier shown to members and used to
// confirm/register them (e.g. over USSD). Format: <3-letter org prefix><6 digits>,
// e.g. "AXA204517". The prefix groups members by their organisation; the random
// suffix + a global unique index keep each ID unique.

export function membershipPrefix(orgName: string): string {
  const letters = (orgName || '').toUpperCase().replace(/[^A-Z]/g, '');
  return (letters.slice(0, 3) || 'MOB').padEnd(3, 'X');
}

function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i += 1) s += Math.floor(Math.random() * 10);
  return s;
}

// Generate a unique membership ID for an org name. `reserved` lets a batch
// (e.g. bulk import) avoid in-flight collisions before the rows are committed.
export async function generateMembershipId(orgName: string, reserved?: Set<string>): Promise<string> {
  const prefix = membershipPrefix(orgName);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const id = prefix + randomDigits(6);
    if (reserved && reserved.has(id)) continue;
    const clash = await query('SELECT 1 FROM members WHERE membership_id = $1', [id]);
    if (clash.rows.length === 0) {
      reserved?.add(id);
      return id;
    }
  }
  // Extremely unlikely fallback — widen the numeric space.
  const id = prefix + randomDigits(8);
  reserved?.add(id);
  return id;
}

// Convenience: look up the org name and generate an ID for it.
export async function newMembershipId(orgId: string, reserved?: Set<string>): Promise<string> {
  const r = await query('SELECT name FROM organisations WHERE id = $1', [orgId]);
  return generateMembershipId(r.rows[0]?.name || 'MobiCova', reserved);
}
