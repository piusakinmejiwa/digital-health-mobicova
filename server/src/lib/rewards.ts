import { query } from '../config/database';

// MobiCova Rewards — Phase 0 (engine) + Phase 1 (streaks, points, badges).
//
// award() is the single entry point. It is IDEMPOTENT (a dedupe key stops an
// action being credited twice) and BEST-EFFORT (it never throws into the caller
// — completing a consult must succeed even if the points write fails). It also
// keeps a per-member streak and grants badges as thresholds are crossed.

export type RewardAction =
  | 'daily_checkin'
  | 'tip_read'
  | 'triage'
  | 'consult_complete'
  | 'prescription_collected'
  | 'profile_complete';

// Points per action, and how each is deduped:
//   perDay – once per member per calendar day (engagement, anti-farm)
//   perRef – once per entity (a specific consult / prescription)
//   once   – once per member, ever (a one-time milestone)
const ACTIONS: Record<RewardAction, { points: number; dedupe: 'perDay' | 'perRef' | 'once' }> = {
  daily_checkin:          { points: 5,  dedupe: 'perDay' },
  tip_read:               { points: 5,  dedupe: 'perDay' },
  triage:                 { points: 10, dedupe: 'perDay' },
  consult_complete:       { points: 25, dedupe: 'perRef' },
  prescription_collected: { points: 20, dedupe: 'perRef' },
  profile_complete:       { points: 15, dedupe: 'once'   },
};

export interface BadgeDef {
  slug: string;
  label: string;
  emoji: string;
  description: string;
  // Earned when this returns true for the member's current stats.
  earned: (s: MemberStats) => boolean;
}

interface MemberStats {
  totalPoints: number;
  currentStreak: number;
  consults: number;
  triages: number;
  refills: number;
  profileDone: boolean;
}

export const BADGES: BadgeDef[] = [
  { slug: 'first-steps',   label: 'First Steps',     emoji: '👣', description: 'Earned your first MobiCova points.', earned: (s) => s.totalPoints > 0 },
  { slug: 'profile-pro',   label: 'Profile Pro',     emoji: '📋', description: 'Completed your health profile.',     earned: (s) => s.profileDone },
  { slug: 'first-consult', label: 'First Consult',   emoji: '🩺', description: 'Completed your first consultation.',  earned: (s) => s.consults >= 1 },
  { slug: 'health-curious',label: 'Health Curious',  emoji: '💡', description: 'Used the Health Buddy for guidance.', earned: (s) => s.triages >= 1 },
  { slug: 'adherence-star',label: 'Adherence Star',  emoji: '💊', description: 'Collected a prescription on time.',   earned: (s) => s.refills >= 1 },
  { slug: 'streak-7',      label: '7-Day Streak',    emoji: '🔥', description: 'Stayed engaged 7 days in a row.',     earned: (s) => s.currentStreak >= 7 },
  { slug: 'streak-30',     label: '30-Day Streak',   emoji: '🏆', description: 'A full month of daily engagement.',    earned: (s) => s.currentStreak >= 30 },
  { slug: 'centurion',     label: 'Centurion',       emoji: '💯', description: 'Reached 100 points.',                 earned: (s) => s.totalPoints >= 100 },
];

function dedupeKey(action: RewardAction, memberId: string, ref?: string): string {
  const cfg = ACTIONS[action];
  if (cfg.dedupe === 'perRef') return `${action}:${ref || memberId}`;
  if (cfg.dedupe === 'once') return `${action}:${memberId}`;
  // perDay
  const today = new Date().toISOString().slice(0, 10);
  return `${action}:${memberId}:${today}`;
}

// Award points for an action. Safe to call from any controller — failures are
// logged and swallowed so they can never break the primary request.
export async function award(
  memberId: string,
  orgId: string | null,
  action: RewardAction,
  opts: { ref?: string } = {}
): Promise<void> {
  try {
    const cfg = ACTIONS[action];
    if (!cfg) return;
    const key = dedupeKey(action, memberId, opts.ref);

    // Ledger insert is the idempotency gate: if this action was already
    // credited, the unique dedupe_key makes this a no-op and we stop.
    const ins = await query(
      `INSERT INTO reward_events (member_id, org_id, action, points, dedupe_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [memberId, orgId, action, cfg.points, key]
    );
    if (ins.rows.length === 0) return; // already awarded — no double credit, no streak bump

    // Atomic running-total + streak update (one statement, no read-modify-write race).
    await query(
      `INSERT INTO member_points (member_id, org_id, total_points, current_streak, longest_streak, last_activity_date, updated_at)
       VALUES ($1, $2, $3, 1, 1, CURRENT_DATE, now())
       ON CONFLICT (member_id) DO UPDATE SET
         total_points = member_points.total_points + EXCLUDED.total_points,
         current_streak = CASE
           WHEN member_points.last_activity_date = CURRENT_DATE     THEN member_points.current_streak
           WHEN member_points.last_activity_date = CURRENT_DATE - 1 THEN member_points.current_streak + 1
           ELSE 1 END,
         longest_streak = GREATEST(member_points.longest_streak, CASE
           WHEN member_points.last_activity_date = CURRENT_DATE     THEN member_points.current_streak
           WHEN member_points.last_activity_date = CURRENT_DATE - 1 THEN member_points.current_streak + 1
           ELSE 1 END),
         last_activity_date = CURRENT_DATE,
         org_id = COALESCE(member_points.org_id, EXCLUDED.org_id),
         updated_at = now()`,
      [memberId, orgId, cfg.points]
    );

    await grantBadges(memberId);
    await checkChallenges(memberId, orgId);
  } catch (err) {
    console.error('[rewards] award failed (non-fatal):', (err as Error).message);
  }
}

// ── Phase 2: challenges ──────────────────────────────────────────────────────
// Period key + SQL lower-bound for a challenge window. periodKey makes the
// completion bonus idempotent per member per period.
function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - fDay + 3);
  const week = 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 86_400_000));
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function windowInfo(win: string): { since: string; key: string } {
  const now = new Date();
  if (win === 'monthly') {
    return { since: "date_trunc('month', now())", key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}` };
  }
  if (win === 'weekly') {
    return { since: "date_trunc('week', now())", key: isoWeekKey(now) };
  }
  return { since: '', key: 'all' }; // once
}

// Credit arbitrary bonus points with a custom dedupe key (no streak bump).
async function creditBonus(memberId: string, orgId: string | null, points: number, key: string): Promise<boolean> {
  const ins = await query(
    `INSERT INTO reward_events (member_id, org_id, action, points, dedupe_key)
     VALUES ($1, $2, 'challenge', $3, $4) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
    [memberId, orgId, points, key]
  );
  if (ins.rows.length === 0) return false;
  await query(
    `INSERT INTO member_points (member_id, org_id, total_points, last_activity_date, updated_at)
     VALUES ($1, $2, $3, CURRENT_DATE, now())
     ON CONFLICT (member_id) DO UPDATE SET
       total_points = member_points.total_points + EXCLUDED.total_points,
       org_id = COALESCE(member_points.org_id, EXCLUDED.org_id), updated_at = now()`,
    [memberId, orgId, points]
  );
  return true;
}

async function challengeProgress(memberId: string, action: string, win: string): Promise<number> {
  const { since } = windowInfo(win);
  const clause = since ? `AND created_at >= ${since}` : '';
  const actionClause = action === 'any' ? '' : 'AND action = $2';
  const params = action === 'any' ? [memberId] : [memberId, action];
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM reward_events WHERE member_id = $1 ${actionClause} ${clause}`,
    params
  );
  return r.rows[0].n;
}

// After an action is awarded, credit any challenge the member has just completed.
async function checkChallenges(memberId: string, orgId: string | null): Promise<void> {
  let challenges: { id: string; action: string; target: number; window: string; bonus_points: number }[];
  try {
    const r = await query(`SELECT id, action, target, window, bonus_points FROM reward_challenges WHERE is_active = true`);
    challenges = r.rows;
  } catch { return; } // table not present yet — skip
  for (const ch of challenges) {
    const progress = await challengeProgress(memberId, ch.action, ch.window);
    if (progress >= ch.target && ch.bonus_points > 0) {
      const { key } = windowInfo(ch.window);
      await creditBonus(memberId, orgId, ch.bonus_points, `challenge:${ch.id}:${memberId}:${key}`);
    }
  }
}

// Member-facing list of active challenges with live progress.
export async function getMemberChallenges(memberId: string): Promise<{
  id: string; title: string; description: string; target: number; window: string;
  bonusPoints: number; current: number; completed: boolean;
}[]> {
  let rows: any[];
  try {
    rows = (await query(
      `SELECT id, title, description, action, target, window, bonus_points
         FROM reward_challenges WHERE is_active = true ORDER BY created_at`,
    )).rows;
  } catch { return []; }
  const out = [];
  for (const ch of rows) {
    const current = await challengeProgress(memberId, ch.action, ch.window);
    out.push({
      id: ch.id, title: ch.title, description: ch.description, target: ch.target, window: ch.window,
      bonusPoints: ch.bonus_points, current: Math.min(current, ch.target), completed: current >= ch.target,
    });
  }
  return out;
}

// ── Phase 2: anonymised, opt-in leaderboard (within the member's org) ────────
export async function setLeaderboardOptIn(memberId: string, orgId: string | null, optIn: boolean): Promise<void> {
  await query(
    `INSERT INTO member_points (member_id, org_id, leaderboard_opt_in, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (member_id) DO UPDATE SET leaderboard_opt_in = $3, updated_at = now()`,
    [memberId, orgId, optIn]
  );
}

export async function getLeaderboard(orgId: string, memberId: string): Promise<{
  optedIn: boolean; rank: number | null; total: number;
  top: { rank: number; points: number; isYou: boolean }[];
}> {
  const meRes = await query('SELECT leaderboard_opt_in FROM member_points WHERE member_id = $1', [memberId]);
  const optedIn = Boolean(meRes.rows[0]?.leaderboard_opt_in);
  if (!optedIn) return { optedIn: false, rank: null, total: 0, top: [] };

  const rows = (await query(
    `SELECT mp.member_id, mp.total_points
       FROM member_points mp JOIN members m ON m.id = mp.member_id
      WHERE m.org_id = $1 AND mp.leaderboard_opt_in = true
      ORDER BY mp.total_points DESC, mp.member_id`,
    [orgId]
  )).rows;
  const idx = rows.findIndex((r) => r.member_id === memberId);
  return {
    optedIn: true,
    rank: idx >= 0 ? idx + 1 : null,
    total: rows.length,
    top: rows.slice(0, 10).map((r, i) => ({ rank: i + 1, points: r.total_points, isYou: r.member_id === memberId })),
  };
}

// Grant any newly-qualified badges. Idempotent via the PK on (member, badge).
async function grantBadges(memberId: string): Promise<void> {
  const stats = await getStats(memberId);
  if (!stats) return;
  const earned = BADGES.filter((b) => b.earned(stats));
  for (const b of earned) {
    await query(
      `INSERT INTO member_badges (member_id, badge_slug) VALUES ($1, $2)
       ON CONFLICT (member_id, badge_slug) DO NOTHING`,
      [memberId, b.slug]
    );
  }
}

async function getStats(memberId: string): Promise<MemberStats | null> {
  const r = await query(
    `SELECT mp.total_points, mp.current_streak,
            COUNT(*) FILTER (WHERE re.action = 'consult_complete')       AS consults,
            COUNT(*) FILTER (WHERE re.action = 'triage')                 AS triages,
            COUNT(*) FILTER (WHERE re.action = 'prescription_collected') AS refills,
            BOOL_OR(re.action = 'profile_complete')                      AS profile_done
       FROM member_points mp
       LEFT JOIN reward_events re ON re.member_id = mp.member_id
      WHERE mp.member_id = $1
      GROUP BY mp.total_points, mp.current_streak`,
    [memberId]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    totalPoints: row.total_points,
    currentStreak: row.current_streak,
    consults: Number(row.consults),
    triages: Number(row.triages),
    refills: Number(row.refills),
    profileDone: !!row.profile_done,
  };
}

// Read model for the member Rewards screen / USSD "My points".
export async function getMemberRewards(memberId: string): Promise<{
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  badges: { slug: string; label: string; emoji: string; description: string; earned: boolean; earnedAt: string | null }[];
}> {
  const ptsRes = await query(
    `SELECT total_points, current_streak, longest_streak FROM member_points WHERE member_id = $1`,
    [memberId]
  );
  const pts = ptsRes.rows[0] || { total_points: 0, current_streak: 0, longest_streak: 0 };

  const earnedRes = await query(
    `SELECT badge_slug, earned_at FROM member_badges WHERE member_id = $1`,
    [memberId]
  );
  const earnedMap = new Map<string, string>(earnedRes.rows.map((r: any) => [r.badge_slug, r.earned_at]));

  // Show the full catalogue so members see what's next to unlock.
  const badges = BADGES.map((b) => ({
    slug: b.slug,
    label: b.label,
    emoji: b.emoji,
    description: b.description,
    earned: earnedMap.has(b.slug),
    earnedAt: earnedMap.get(b.slug) || null,
  }));

  return {
    totalPoints: pts.total_points,
    currentStreak: pts.current_streak,
    longestStreak: pts.longest_streak,
    badges,
  };
}
