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

// Is this session still valid (exists and not revoked)? Returns true when the
// sessions table is unavailable so a transient DB issue never locks users out.
export async function isSessionActive(sid: string): Promise<boolean> {
  try {
    const r = await query('SELECT revoked_at FROM user_sessions WHERE id = $1', [sid]);
    if (r.rows.length === 0) return true;          // unknown sid — don't block
    return !r.rows[0].revoked_at;
  } catch {
    return true;
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
