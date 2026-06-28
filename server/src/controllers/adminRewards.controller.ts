import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';

// Platform-admin management of Rewards Phase 2 challenges. Challenges are
// platform-level (one set for all members); progress + bonus are handled by the
// rewards engine.

const ACTIONS = ['any', 'daily_checkin', 'tip_read', 'triage', 'consult_complete', 'prescription_collected', 'profile_complete'];
const WINDOWS = ['weekly', 'monthly', 'once'];

export async function adminListChallenges(_req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, title, description, action, target, window, bonus_points, is_active, created_at
       FROM reward_challenges ORDER BY created_at DESC`
  );
  res.json({ challenges: r.rows, actions: ACTIONS, windows: WINDOWS });
}

export async function adminCreateChallenge(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 160);
  if (!title) { res.status(400).json({ error: 'Title is required.' }); return; }
  const action = ACTIONS.includes(b.action) ? b.action : 'any';
  const window = WINDOWS.includes(b.window) ? b.window : 'weekly';
  const target = Math.max(1, Math.floor(Number(b.target) || 1));
  const bonus = Math.max(0, Math.floor(Number(b.bonusPoints) || 0));
  const r = await query(
    `INSERT INTO reward_challenges (title, description, action, target, window, bonus_points, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title, String(b.description || '').slice(0, 500), action, target, window, bonus, b.isActive !== false]
  );
  await recordAudit(req, { action: 'rewards.challenge_create', targetType: 'challenge', targetId: r.rows[0].id, targetLabel: title, orgId: req.user!.orgId });
  res.status(201).json(r.rows[0]);
}

export async function adminUpdateChallenge(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id);
  const b = req.body || {};
  const r = await query(
    `UPDATE reward_challenges SET
       title = COALESCE($2, title), description = COALESCE($3, description),
       action = COALESCE($4, action), target = COALESCE($5, target),
       window = COALESCE($6, window), bonus_points = COALESCE($7, bonus_points),
       is_active = COALESCE($8, is_active), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [
      id,
      b.title !== undefined ? String(b.title).slice(0, 160) : null,
      b.description !== undefined ? String(b.description).slice(0, 500) : null,
      b.action !== undefined && ACTIONS.includes(b.action) ? b.action : null,
      b.target !== undefined ? Math.max(1, Math.floor(Number(b.target) || 1)) : null,
      b.window !== undefined && WINDOWS.includes(b.window) ? b.window : null,
      b.bonusPoints !== undefined ? Math.max(0, Math.floor(Number(b.bonusPoints) || 0)) : null,
      b.isActive !== undefined ? Boolean(b.isActive) : null,
    ]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Challenge not found' }); return; }
  res.json(r.rows[0]);
}

export async function adminDeleteChallenge(req: Request, res: Response): Promise<void> {
  await query('DELETE FROM reward_challenges WHERE id = $1', [String(req.params.id)]);
  res.json({ deleted: true });
}
