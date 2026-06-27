import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';

// In-app tenant compliance surface (Trust & Security Centre). An org admin can
// review/accept the Data Processing Agreement and request a data export. Keep
// the DPA version in sync with the client's lib/trust.ts DPA_VERSION.
const DPA_VERSION = '2026-06';

export async function getCompliance(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const [c, exports] = await Promise.all([
    query('SELECT dpa_accepted_at, dpa_accepted_name, dpa_version FROM org_compliance WHERE org_id = $1', [orgId]),
    query(
      `SELECT id, requester, scope, status, note, created_at
         FROM data_export_requests WHERE org_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [orgId]
    ),
  ]);
  const row = c.rows[0];
  res.json({
    dpa: row?.dpa_accepted_at
      ? { acceptedAt: row.dpa_accepted_at, acceptedName: row.dpa_accepted_name, version: row.dpa_version }
      : null,
    currentDpaVersion: DPA_VERSION,
    upToDate: Boolean(row?.dpa_accepted_at) && row.dpa_version === DPA_VERSION,
    exports: exports.rows,
  });
}

// POST /settings/compliance/dpa/accept { name? } — admin records DPA acceptance.
export async function acceptDpa(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const userId = req.user!.userId;
  let name = String(req.body?.name || '').trim().slice(0, 160);
  if (!name) {
    const u = await query('SELECT full_name FROM users WHERE id = $1', [userId]);
    name = u.rows[0]?.full_name || '';
  }
  await query(
    `INSERT INTO org_compliance (org_id, dpa_accepted_at, dpa_accepted_by, dpa_accepted_name, dpa_version, updated_at)
     VALUES ($1, now(), $2, $3, $4, now())
     ON CONFLICT (org_id) DO UPDATE
       SET dpa_accepted_at = now(), dpa_accepted_by = $2,
           dpa_accepted_name = $3, dpa_version = $4, updated_at = now()`,
    [orgId, userId, name, DPA_VERSION]
  );
  await recordAudit(req, {
    action: 'compliance.dpa_accept', targetType: 'organisation', targetId: orgId,
    orgId, metadata: { version: DPA_VERSION, name },
  });
  res.json({ accepted: true, dpa: { acceptedName: name, version: DPA_VERSION } });
}

// POST /settings/compliance/data-export { scope?, note? } — admin requests an export.
export async function requestDataExport(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const userId = req.user!.userId;
  const scope = String(req.body?.scope || 'all').slice(0, 40);
  const note = String(req.body?.note || '').slice(0, 500);
  const u = await query('SELECT full_name FROM users WHERE id = $1', [userId]);
  const requester = u.rows[0]?.full_name || '';
  const r = await query(
    `INSERT INTO data_export_requests (org_id, requested_by, requester, scope, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, requester, scope, status, note, created_at`,
    [orgId, userId, requester, scope, note]
  );
  await recordAudit(req, {
    action: 'compliance.data_export_request', targetType: 'organisation', targetId: orgId,
    orgId, metadata: { scope },
  });
  res.status(201).json(r.rows[0]);
}
