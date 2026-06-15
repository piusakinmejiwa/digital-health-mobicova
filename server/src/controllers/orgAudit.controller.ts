import { Request, Response } from 'express';
import { query } from '../config/database';

// A partner/org admin's view of activity in THEIR OWN organisation only. Scoped
// hard to req.user.orgId so one org can never see another's trail. Admin-only;
// the IP column is deliberately not exposed to partners (kept for platform admins).
export async function listOrgActivity(req: Request, res: Response): Promise<void> {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const orgId = req.user!.orgId;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '150'), 10) || 150, 1), 500);

  const result = await query(
    `SELECT a.id, a.actor_email, a.action, a.target_type, a.target_id,
            a.target_label, a.metadata, a.created_at
       FROM audit_log a
      WHERE a.org_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2`,
    [orgId, limit]
  );
  res.json(result.rows);
}
