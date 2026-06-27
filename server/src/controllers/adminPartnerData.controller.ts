import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { query, pool } from '../config/database';
import { recordAudit } from '../lib/audit';
import {
  storageEnabled, uploadOrgFile, signedUrlForPath, deleteStoredFile, UploadableFile,
} from '../config/storage';

// Doctor-network onboarding for a partner (e.g. HealthConnect247): bulk-register
// providers from a file, and store the network's compliance documents.

const EMAIL_RE = /.+@.+\..+/;
const IMPORT_MAX = 1000;

// A strong temp password (meets the policy in lib/password) returned to the
// admin to distribute; providers can be reset individually any time.
function genTempPassword(): string {
  return randomUUID().replace(/-/g, '').slice(0, 10) + 'Aa9!';
}

// POST /admin/partners/:id/providers/import  { providers:[], dryRun? }
export async function adminBulkImportProviders(req: Request, res: Response): Promise<void> {
  const partnerId = String(req.params.id);
  const partner = await query('SELECT id, name FROM partners WHERE id = $1', [partnerId]);
  if (partner.rows.length === 0) { res.status(404).json({ error: 'Partner not found' }); return; }

  const dryRun = Boolean(req.body?.dryRun);
  const rows: Record<string, unknown>[] = Array.isArray(req.body?.providers) ? req.body.providers : [];
  if (rows.length === 0) { res.status(400).json({ error: 'No rows to import.' }); return; }
  if (rows.length > IMPORT_MAX) { res.status(400).json({ error: `Too many rows: ${rows.length} (max ${IMPORT_MAX}).` }); return; }

  // Emails already taken (providers.email is unique).
  const fileEmails = rows.map((r) => String(r?.email || '').trim().toLowerCase()).filter(Boolean);
  const existing = fileEmails.length
    ? await query(`SELECT lower(email) AS email FROM providers WHERE lower(email) = ANY($1)`, [fileEmails])
    : { rows: [] as { email: string }[] };
  const taken = new Set(existing.rows.map((r: { email: string }) => r.email));

  const valid: { fullName: string; email: string; role: string; specialty: string; phone: string; mdcn: string }[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();

  rows.forEach((raw, i) => {
    const r = (raw || {}) as Record<string, unknown>;
    const rowNum = i + 1;
    const fullName = String(r.fullName || '').trim();
    const email = String(r.email || '').trim();
    if (!fullName) { skipped.push({ row: rowNum, reason: 'Full name is required' }); return; }
    if (!email || !EMAIL_RE.test(email)) { skipped.push({ row: rowNum, reason: 'A valid email is required' }); return; }
    const lower = email.toLowerCase();
    if (seen.has(lower)) { skipped.push({ row: rowNum, reason: `Duplicate email in file: ${email}` }); return; }
    if (taken.has(lower)) { skipped.push({ row: rowNum, reason: `A provider already exists with ${email}` }); return; }
    seen.add(lower);
    let role = String(r.role || 'doctor').toLowerCase();
    if (role !== 'doctor' && role !== 'pharmacist') role = 'doctor';
    valid.push({
      fullName, email, role,
      specialty: String(r.specialty || '').slice(0, 120),
      phone: String(r.phone || '').slice(0, 40),
      mdcn: String(r.mdcnNumber || r.mdcn || '').slice(0, 40),
    });
  });

  if (dryRun) {
    res.json({
      dryRun: true, wouldImport: valid.length, skipped, total: rows.length,
      preview: valid.slice(0, 8).map((v) => ({ fullName: v.fullName, email: v.email, role: v.role, mdcn: v.mdcn })),
    });
    return;
  }
  if (valid.length === 0) { res.status(400).json({ inserted: 0, skipped, total: rows.length, error: 'No valid rows to import.' }); return; }

  // All succeed together or not at all; collect the temp credentials to hand back.
  const credentials: { fullName: string; email: string; tempPassword: string }[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const v of valid) {
      const tempPassword = genTempPassword();
      const hash = await bcrypt.hash(tempPassword, 12);
      await client.query(
        `INSERT INTO providers (partner_id, full_name, email, password_hash, role, specialty, phone, mdcn_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [partnerId, v.fullName, v.email, hash, v.role, v.specialty, v.phone, v.mdcn]
      );
      credentials.push({ fullName: v.fullName, email: v.email, tempPassword });
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  await recordAudit(req, {
    action: 'provider.bulk_import', targetType: 'partner', targetId: partnerId,
    targetLabel: partner.rows[0].name, metadata: { inserted: valid.length, total: rows.length },
  });
  res.status(201).json({ inserted: valid.length, skipped, total: rows.length, credentials });
}

// ── Partner (network) compliance documents — private storage ───────────────

export async function adminListPartnerDocuments(req: Request, res: Response): Promise<void> {
  const partnerId = String(req.params.id);
  const r = await query(
    `SELECT id, doc_type, file_name, storage_path, content_type, size_bytes, uploaded_at
       FROM partner_documents WHERE partner_id = $1 ORDER BY uploaded_at DESC`,
    [partnerId]
  );
  const documents = await Promise.all(r.rows.map(async (d: any) => ({
    id: d.id, docType: d.doc_type, fileName: d.file_name,
    contentType: d.content_type, sizeBytes: d.size_bytes, uploadedAt: d.uploaded_at,
    url: await signedUrlForPath(d.storage_path),
  })));
  res.json({ storageEnabled, documents });
}

export async function adminUploadPartnerDocument(req: Request, res: Response): Promise<void> {
  const partnerId = String(req.params.id);
  if (!storageEnabled) { res.status(503).json({ error: 'Document storage is not configured on this server.' }); return; }
  const file = (req as Request & { file?: UploadableFile }).file;
  if (!file) { res.status(400).json({ error: 'No file uploaded.' }); return; }

  const partner = await query('SELECT id, name FROM partners WHERE id = $1', [partnerId]);
  if (partner.rows.length === 0) { res.status(404).json({ error: 'Partner not found' }); return; }
  const docType = String(req.body?.docType || 'other').slice(0, 40) || 'other';

  const { path } = await uploadOrgFile(partnerId, file);
  const ins = await query(
    `INSERT INTO partner_documents (partner_id, doc_type, file_name, storage_path, content_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, uploaded_at`,
    [partnerId, docType, file.originalname.slice(0, 255), path, file.mimetype || '', file.buffer.length]
  );
  await recordAudit(req, { action: 'partner.document.upload', targetType: 'partner', targetId: partnerId, targetLabel: partner.rows[0].name, metadata: { docType } });
  res.status(201).json({
    id: ins.rows[0].id, docType, fileName: file.originalname,
    contentType: file.mimetype, sizeBytes: file.buffer.length, uploadedAt: ins.rows[0].uploaded_at,
    url: await signedUrlForPath(path),
  });
}

export async function adminDeletePartnerDocument(req: Request, res: Response): Promise<void> {
  const { id, docId } = req.params;
  const r = await query('SELECT storage_path FROM partner_documents WHERE id = $1 AND partner_id = $2', [docId, id]);
  if (r.rows.length === 0) { res.status(404).json({ error: 'Document not found' }); return; }
  await deleteStoredFile(r.rows[0].storage_path);
  await query('DELETE FROM partner_documents WHERE id = $1', [docId]);
  await recordAudit(req, { action: 'partner.document.delete', targetType: 'partner', targetId: String(id) });
  res.json({ ok: true });
}
