import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';
import {
  storageEnabled, uploadOrgFile, signedUrlForPath, deleteStoredFile, UploadableFile,
} from '../config/storage';

// Platform-admin: an organisation's onboarding documents (private storage) and
// its generic HR/payroll integration config. Behind authenticate +
// requirePlatformAdmin (see admin.routes.ts).

const DOC_TYPES = new Set(['cac_certificate', 'tax_certificate', 'staff_list', 'company_id_template', 'other']);

// GET /admin/organisations/:id/documents — list with fresh signed download URLs.
export async function adminListOrgDocuments(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const r = await query(
    `SELECT id, doc_type, file_name, storage_path, content_type, size_bytes, uploaded_at
       FROM org_documents WHERE org_id = $1 ORDER BY uploaded_at DESC`,
    [id]
  );
  const documents = await Promise.all(r.rows.map(async (d: any) => ({
    id: d.id, docType: d.doc_type, fileName: d.file_name,
    contentType: d.content_type, sizeBytes: d.size_bytes, uploadedAt: d.uploaded_at,
    url: await signedUrlForPath(d.storage_path),
  })));
  res.json({ storageEnabled, documents });
}

// POST /admin/organisations/:id/documents — multipart upload (field: file, body: docType).
export async function adminUploadOrgDocument(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!storageEnabled) {
    res.status(503).json({ error: 'Document storage is not configured on this server.' });
    return;
  }
  const file = (req as Request & { file?: UploadableFile }).file;
  if (!file) { res.status(400).json({ error: 'No file uploaded.' }); return; }

  const docType = DOC_TYPES.has(String(req.body?.docType)) ? String(req.body.docType) : 'other';
  const org = await query('SELECT id, name FROM organisations WHERE id = $1', [id]);
  if (org.rows.length === 0) { res.status(404).json({ error: 'Organisation not found' }); return; }

  const { path } = await uploadOrgFile(String(id), file);
  const ins = await query(
    `INSERT INTO org_documents (org_id, doc_type, file_name, storage_path, content_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, uploaded_at`,
    [id, docType, file.originalname.slice(0, 255), path, file.mimetype || '', file.buffer.length]
  );
  await recordAudit(req, { action: 'org.document.upload', targetType: 'organisation', targetId: id, targetLabel: org.rows[0].name, orgId: id, metadata: { docType } });

  res.status(201).json({
    id: ins.rows[0].id, docType, fileName: file.originalname,
    contentType: file.mimetype, sizeBytes: file.buffer.length, uploadedAt: ins.rows[0].uploaded_at,
    url: await signedUrlForPath(path),
  });
}

// DELETE /admin/organisations/:id/documents/:docId
export async function adminDeleteOrgDocument(req: Request, res: Response): Promise<void> {
  const { id, docId } = req.params;
  const r = await query('SELECT storage_path FROM org_documents WHERE id = $1 AND org_id = $2', [docId, id]);
  if (r.rows.length === 0) { res.status(404).json({ error: 'Document not found' }); return; }
  await deleteStoredFile(r.rows[0].storage_path);
  await query('DELETE FROM org_documents WHERE id = $1', [docId]);
  await recordAudit(req, { action: 'org.document.delete', targetType: 'organisation', targetId: id, orgId: id });
  res.json({ ok: true });
}

// ── HR / payroll integration (generic scaffold) ────────────────────────────

// GET /admin/organisations/:id/hr — config WITHOUT the secret key (just whether one is set).
export async function adminGetOrgHr(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const r = await query(
    `SELECT provider, api_base_url, sync_cadence, status, last_synced_at,
            (api_key <> '') AS has_key
       FROM org_hr_integration WHERE org_id = $1`,
    [id]
  );
  const row = r.rows[0];
  res.json(row
    ? { provider: row.provider, apiBaseUrl: row.api_base_url, syncCadence: row.sync_cadence, status: row.status, lastSyncedAt: row.last_synced_at, hasKey: row.has_key }
    : { provider: '', apiBaseUrl: '', syncCadence: 'manual', status: 'disconnected', lastSyncedAt: null, hasKey: false });
}

// PUT /admin/organisations/:id/hr — save provider/endpoint/cadence (+ optional key).
// An empty apiKey leaves the stored key untouched; sending a value replaces it.
export async function adminSaveOrgHr(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const provider = String(req.body?.provider || '').slice(0, 120);
  const apiBaseUrl = String(req.body?.apiBaseUrl || '').slice(0, 500);
  const cadence = ['manual', 'daily', 'weekly'].includes(req.body?.syncCadence) ? req.body.syncCadence : 'manual';
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey : '';
  // Connected once a provider + endpoint are present.
  const status = provider && apiBaseUrl ? 'connected' : 'disconnected';

  await query(
    `INSERT INTO org_hr_integration (org_id, provider, api_base_url, api_key, sync_cadence, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (org_id) DO UPDATE SET
       provider = EXCLUDED.provider,
       api_base_url = EXCLUDED.api_base_url,
       api_key = CASE WHEN $4 <> '' THEN EXCLUDED.api_key ELSE org_hr_integration.api_key END,
       sync_cadence = EXCLUDED.sync_cadence,
       status = EXCLUDED.status,
       updated_at = now()`,
    [id, provider, apiBaseUrl, apiKey, cadence, status]
  );
  await recordAudit(req, { action: 'org.hr.save', targetType: 'organisation', targetId: id, orgId: id, metadata: { provider, status } });
  res.json({ ok: true, status });
}

// POST /admin/organisations/:id/hr/sync — scaffolded. The connector to a specific
// HRIS is wired later; for now this records the attempt so the UI/flow is real.
export async function adminSyncOrgHr(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const r = await query('SELECT provider, api_base_url, status FROM org_hr_integration WHERE org_id = $1', [id]);
  const row = r.rows[0];
  if (!row || row.status !== 'connected') {
    res.status(400).json({ error: 'Connect an HR provider (name + endpoint) before syncing.' });
    return;
  }
  await query('UPDATE org_hr_integration SET last_synced_at = now(), updated_at = now() WHERE org_id = $1', [id]);
  await recordAudit(req, { action: 'org.hr.sync', targetType: 'organisation', targetId: id, orgId: id });
  // Live member pull from the HRIS is not yet wired — surfaced honestly to the UI.
  res.json({ ok: true, pulled: 0, note: `Connection to ${row.provider} recorded. Live member sync is not yet enabled — use CSV import for now.` });
}
