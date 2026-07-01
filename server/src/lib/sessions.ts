import { Request } from 'express';
import { query } from '../config/database';

// Session tracking for staff accounts. Best-effort: if the sessions table isn't
// there yet (migration not applied) or a write fails, we return null and the
// caller issues a token WITHOUT a sid — login still works, just untracked.

export async function createSession(userId: string, req: Request): Promise<string | null> {
  try {
    const ua = String(req.headers['user-agent'] || '').slice(0, 400);
    const fwd = req.headers['x-forwarded-for'];
    const ip = String((Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0] || req.ip || '').slice(0, 80);
    const r = await query(
      `INSERT INTO user_sessions (user_id, user_agent, ip) VALUES ($1, $2, $3) RETURNING id`,
      [userId, ua, ip]
    );
    return r.rows[0].id as string;
  } catch (err) {
    console.error('[sessions] create failed:', (err as Error).message);
    return null;
  }
}

// Is this session still valid (exists and not revoked)? Fails CLOSED so
// "sign out everywhere" is authoritative: a token whose session row is absent
// (purged) or revoked is rejected, and a DB error rejects too. The ONE exception
// is the sessions table not existing yet (migration 058 not applied) — that
// legacy state is allowed so login can't break before the migration runs.
// Revocation sets revoked_at (the row persists), so an active session always has
// a row; row-absent therefore only means purged/expired → deny.
export async function isSessionActive(sid: string): Promise<boolean> {
  try {
    const r = await query('SELECT revoked_at FROM user_sessions WHERE id = $1', [sid]);
    if (r.rows.length === 0) return false;         // no session row → treat as revoked
    return !r.rows[0].revoked_at;
  } catch (err) {
    if ((err as { code?: string }).code === '42P01') return true; // table missing (pre-migration) → allow
    console.error('[sessions] isSessionActive failed (denying):', (err as Error).message);
    return false;                                  // any other DB error → fail closed
  }
}

// Throttled last-seen bump (fire-and-forget; ~once per 5 min per session).
export function touchSession(sid: string): void {
  void query(
    `UPDATE user_sessions SET last_seen_at = now()
      WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'`,
    [sid]
  ).catch(() => { /* ignore */ });
}
