import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';

// Tenant (Company Admin) rewards management — scoped to the caller's own org.
// Mirrors the platform-admin rewards controller but every row is tied to
// req.user.orgId, so a Company Admin only ever sees/edits their own programme.
// Members additionally see MobiCova's global (org_id NULL) rewards.

const ACTIONS = ['any', 'daily_checkin', 'tip_read', 'triage', 'consult_complete', 'prescription_collected', 'profile_complete'];
const WINDOWS = ['weekly', 'monthly', 'once'];
const KINDS = ['airtime', 'premium_discount', 'voucher', 'other'];

// ── Challenges ───────────────────────────────────────────────────────────────
export async function orgListChallenges(req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, title, description, action, target, window_kind AS "window", bonus_points, is_active, created_at
       FROM reward_challenges WHERE org_id = $1 ORDER BY created_at DESC`,
    [req.user!.orgId]
  );
  res.json({ challenges: r.rows, actions: ACTIONS, windows: WINDOWS });
}

export async function orgCreateChallenge(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 160);
  if (!title) { res.status(400).json({ error: 'Title is required.' }); return; }
  const action = ACTIONS.includes(b.action) ? b.action : 'any';
  const window = WINDOWS.includes(b.window) ? b.window : 'weekly';
  const target = Math.max(1, Math.floor(Number(b.target) || 1));
  const bonus = Math.max(0, Math.floor(Number(b.bonusPoints) || 0));
  const r = await query(
    `INSERT INTO reward_challenges (title, description, action, target, window_kind, bonus_points, is_active, org_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, String(b.description || '').slice(0, 500), action, target, window, bonus, b.isActive !== false, req.user!.orgId]
  );
  await recordAudit(req, { action: 'rewards.challenge_create', targetType: 'challenge', targetId: r.rows[0].id, targetLabel: title, orgId: req.user!.orgId });
  res.status(201).json(r.rows[0]);
}

export async function orgUpdateChallenge(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const r = await query(
    `UPDATE reward_challenges SET
       title = COALESCE($3, title), description = COALESCE($4, description),
       action = COALESCE($5, action), target = COALESCE($6, target),
       window_kind = COALESCE($7, window_kind), bonus_points = COALESCE($8, bonus_points),
       is_active = COALESCE($9, is_active), updated_at = now()
     WHERE id = $1 AND org_id = $2 RETURNING *`,
    [
      String(req.params.id), req.user!.orgId,
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

export async function orgDeleteChallenge(req: Request, res: Response): Promise<void> {
  await query('DELETE FROM reward_challenges WHERE id = $1 AND org_id = $2', [String(req.params.id), req.user!.orgId]);
  res.json({ deleted: true });
}

// ── Catalogue ────────────────────────────────────────────────────────────────
export async function orgListCatalogue(req: Request, res: Response): Promise<void> {
  const r = await query(
    `SELECT id, title, description, kind, cost_points, value_label, stock, is_active, created_at
       FROM reward_catalogue WHERE org_id = $1 ORDER BY created_at DESC`,
    [req.user!.orgId]
  );
  res.json({ items: r.rows, kinds: KINDS });
}

export async function orgCreateCatalogueItem(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 160);
  const cost = Math.max(1, Math.floor(Number(b.costPoints) || 0));
  if (!title || !cost) { res.status(400).json({ error: 'Title and a positive point cost are required.' }); return; }
  const stock = b.stock === '' || b.stock == null ? null : Math.max(0, Math.floor(Number(b.stock)));
  const r = await query(
    `INSERT INTO reward_catalogue (title, description, kind, cost_points, value_label, stock, is_active, org_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, String(b.description || '').slice(0, 500), KINDS.includes(b.kind) ? b.kind : 'voucher', cost, String(b.valueLabel || '').slice(0, 80), stock, b.isActive !== false, req.user!.orgId]
  );
  await recordAudit(req, { action: 'rewards.catalogue_create', targetType: 'reward', targetId: r.rows[0].id, targetLabel: title, orgId: req.user!.orgId });
  res.status(201).json(r.rows[0]);
}

export async function orgUpdateCatalogueItem(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  const stockProvided = b.stock !== undefined;
  const stock = b.stock === '' || b.stock == null ? null : Math.max(0, Math.floor(Number(b.stock)));
  const r = await query(
    `UPDATE reward_catalogue SET
       title = COALESCE($3, title), description = COALESCE($4, description),
       kind = COALESCE($5, kind), cost_points = COALESCE($6, cost_points),
       value_label = COALESCE($7, value_label),
       stock = CASE WHEN $8 THEN $9 ELSE stock END,
       is_active = COALESCE($10, is_active), updated_at = now()
     WHERE id = $1 AND org_id = $2 RETURNING *`,
    [
      String(req.params.id), req.user!.orgId,
      b.title !== undefined ? String(b.title).slice(0, 160) : null,
      b.description !== undefined ? String(b.description).slice(0, 500) : null,
      b.kind !== undefined && KINDS.includes(b.kind) ? b.kind : null,
      b.costPoints !== undefined ? Math.max(1, Math.floor(Number(b.costPoints) || 1)) : null,
      b.valueLabel !== undefined ? String(b.valueLabel).slice(0, 80) : null,
      stockProvided, stock,
      b.isActive !== undefined ? Boolean(b.isActive) : null,
    ]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Reward not found' }); return; }
  res.json(r.rows[0]);
}

export async function orgDeleteCatalogueItem(req: Request, res: Response): Promise<void> {
  await query('DELETE FROM reward_catalogue WHERE id = $1 AND org_id = $2', [String(req.params.id), req.user!.orgId]);
  res.json({ deleted: true });
}

// ── Redemptions (this org's members only) ────────────────────────────────────
export async function orgListRedemptions(req: Request, res: Response): Promise<void> {
  const status = String(req.query.status || '');
  const params: unknown[] = [req.user!.orgId];
  let where = 'WHERE r.org_id = $1';
  if (status) { params.push(status); where += ' AND r.status = $2'; }
  const rows = await query(
    `SELECT r.id, r.title, r.cost_points, r.status, r.note, r.created_at,
            m.full_name AS member_name, m.phone AS member_phone
       FROM reward_redemptions r JOIN members m ON m.id = r.member_id
       ${where}
      ORDER BY r.created_at DESC LIMIT 200`,
    params
  );
  res.json({ redemptions: rows.rows });
}

export async function orgUpdateRedemption(req: Request, res: Response): Promise<void> {
  const status = String(req.body?.status || '');
  if (!['requested', 'approved', 'fulfilled', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Invalid status.' }); return;
  }
  const r = await query(
    `UPDATE reward_redemptions SET status = $3, updated_at = now()
      WHERE id = $1 AND org_id = $2 RETURNING id, catalogue_id, status`,
    [String(req.params.id), req.user!.orgId, status]
  );
  if (r.rows.length === 0) { res.status(404).json({ error: 'Redemption not found' }); return; }
  if (status === 'rejected' && r.rows[0].catalogue_id) {
    await query('UPDATE reward_catalogue SET stock = stock + 1 WHERE id = $1 AND stock IS NOT NULL', [r.rows[0].catalogue_id]);
  }
  await recordAudit(req, { action: 'rewards.redemption_update', targetType: 'redemption', targetId: r.rows[0].id, orgId: req.user!.orgId, metadata: { status } });
  res.json(r.rows[0]);
}
