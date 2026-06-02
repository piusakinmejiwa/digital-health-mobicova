import { Request, Response } from 'express';
import { query } from '../config/database';

// Read-only access to the audit trail for platform admins. Behind
// authenticate + requirePlatformAdmin (see admin.routes.ts).
export async function adminListAudit(req: Request, res: Response): Promise<void> {
  // Optional filters: ?orgId=… (one tenant), ?limit=… (default 100, capped 500).
  const { orgId } = req.query;
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '100'), 10) || 100, 1), 500);

  const params: (string | number)[] = [];
  let where = '';
  if (orgId) {
    params.push(String(orgId));
    where = 'WHERE a.org_id = $1';
  }
  params.push(limit);

  const result = await query(
    `SELECT a.id, a.actor_email, a.action, a.target_type, a.target_id,
            a.target_label, a.org_id, a.metadata, a.ip, a.created_at,
            o.name AS org_name
       FROM audit_log a
       LEFT JOIN organisations o ON a.org_id = o.id
       ${where}
      ORDER BY a.created_at DESC
      LIMIT $${params.length}`,
    params
  );
  res.json(result.rows);
}
