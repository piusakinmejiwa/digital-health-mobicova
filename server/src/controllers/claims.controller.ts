import { Request, Response } from 'express';
import { query } from '../config/database';
import { recordAudit } from '../lib/audit';
import { storageEnabled, uploadClaimFile, UploadableFile } from '../config/storage';
import {
  CLAIM_STATUSES, CLAIM_TYPES, canTransition, generateClaimReference, isClaimStatus, isClaimType,
} from '../lib/claims';
import { emitEvent } from '../lib/webhooks';
import { reviewClaim, reviewClaimSafe, ClaimReviewUnavailable } from '../lib/claimReview';

// Shared envelope for claim webhook payloads — kept consistent across create and
// status-change events.
function claimEventPayload(claim: Record<string, any>): Record<string, unknown> {
  return {
    claim_id: claim.id,
    reference: claim.reference,
    member_id: claim.member_id,
    claim_type: claim.claim_type,
    provider_name: claim.provider_name,
    amount: claim.amount,
    currency: claim.currency,
    status: claim.status,
    submitted_via: claim.submitted_via,
    created_at: claim.created_at,
    updated_at: claim.updated_at,
  };
}

// Shared projection: a claim row enriched with the member, plan/underwriter it
// is made against, who decided it, and a document count for the list view.
const CLAIM_SELECT = `
  SELECT c.*,
         m.full_name AS member_name, m.email AS member_email, m.phone AS member_phone,
         pl.name AS plan_name, pl.underwriter,
         du.full_name AS decided_by_name,
         (SELECT COUNT(*)::int FROM claim_documents d WHERE d.claim_id = c.id) AS document_count
  FROM claims c
  JOIN members m ON c.member_id = m.id
  LEFT JOIN insurance_plans pl ON c.plan_id = pl.id
  LEFT JOIN users du ON c.decided_by = du.id
`;

// GET /claims?status= — the partner's claims queue, newest first, plus per-status
// counts for the filter header. Open to all roles (read).
export async function listClaims(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const status = req.query.status ? String(req.query.status) : null;

  const params: unknown[] = [orgId];
  let where = 'WHERE c.org_id = $1';
  if (status && isClaimStatus(status)) {
    params.push(status);
    where += ` AND c.status = $${params.length}`;
  }

  const result = await query(`${CLAIM_SELECT} ${where} ORDER BY c.created_at DESC`, params as any[]);
  const counts = await query(
    `SELECT status, COUNT(*)::int AS count FROM claims WHERE org_id = $1 GROUP BY status`,
    [orgId]
  );

  res.json({ claims: result.rows, counts: counts.rows, storageEnabled });
}

// GET /claims/:id — full claim with its attached documents.
export async function getClaim(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);

  const result = await query(`${CLAIM_SELECT} WHERE c.id = $1 AND c.org_id = $2`, [id, orgId]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  const docs = await query(
    `SELECT id, label, file_name, file_url, content_type, size_bytes, created_at
     FROM claim_documents WHERE claim_id = $1 ORDER BY created_at`,
    [id]
  );
  res.json({ ...result.rows[0], documents: docs.rows });
}

// POST /claims — log a claim on behalf of a member (call-centre / front-desk
// intake). Member self-submission arrives with the Q10 member portal and reuses
// this same insert path. Requires write access (admin/manager).
export async function createClaim(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const { memberId, claimType, providerName, amount, currency, description, serviceDate, enrolmentId } = req.body;

  const member = await query('SELECT id FROM members WHERE id = $1 AND org_id = $2', [memberId, orgId]);
  if (member.rows.length === 0) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }

  // When an enrolment is named, link the claim to that cover and copy its plan.
  let resolvedEnrolment: string | null = null;
  let planId: string | null = null;
  if (enrolmentId) {
    const en = await query(
      'SELECT id, plan_id FROM enrolments WHERE id = $1 AND org_id = $2 AND member_id = $3',
      [enrolmentId, orgId, memberId]
    );
    if (en.rows.length > 0) {
      resolvedEnrolment = en.rows[0].id;
      planId = en.rows[0].plan_id;
    }
  }

  const reference = generateClaimReference();
  const result = await query(
    `INSERT INTO claims
       (org_id, member_id, enrolment_id, plan_id, reference, claim_type,
        provider_name, service_date, amount, currency, description, submitted_via)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'dashboard')
     RETURNING *`,
    [
      orgId, memberId, resolvedEnrolment, planId, reference,
      isClaimType(claimType) ? claimType : 'outpatient',
      (providerName || '').toString().slice(0, 255),
      serviceDate || null,
      Number(amount) || 0,
      (currency || 'NGN').toString().toUpperCase().slice(0, 10),
      (description || '').toString(),
    ]
  );
  const claim = result.rows[0];

  await recordAudit(req, {
    action: 'claim.create', targetType: 'claim', targetId: claim.id,
    targetLabel: reference, orgId, metadata: { memberId, amount: claim.amount },
  });

  emitEvent(orgId, 'claim.created', claimEventPayload(claim));

  // Best-effort AI integrity review in the background — the claim appears
  // immediately; its AI verdict lands a moment later (no-op if AI is off).
  reviewClaimSafe(orgId, claim.id);

  res.status(201).json(claim);
}

// POST /claims/:id/ai-review — run (or re-run) the AI anomaly review. Decision
// support only: it flags for a human, never adjudicates. Requires write access.
export async function aiReviewClaim(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);

  const exists = await query('SELECT 1 FROM claims WHERE id = $1 AND org_id = $2', [id, orgId]);
  if (exists.rows.length === 0) { res.status(404).json({ error: 'Claim not found' }); return; }

  try {
    const review = await reviewClaim(orgId, id);
    await recordAudit(req, {
      action: 'claim.ai_review', targetType: 'claim', targetId: id,
      orgId, metadata: { verdict: review.ai_status, risk: review.ai_risk },
    });
    res.json(review);
  } catch (err) {
    if (err instanceof ClaimReviewUnavailable) {
      res.status(503).json({ error: err.message });
      return;
    }
    console.error('Claim AI review failed:', err);
    res.status(500).json({ error: 'Could not review the claim. Please try again.' });
  }
}

// PATCH /claims/:id/decision — advance a claim through the adjudication state
// machine (under_review / approved / rejected / paid). Requires write access.
export async function decideClaim(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);
  const { status, note } = req.body;

  if (!isClaimStatus(status)) {
    res.status(400).json({ error: `Status must be one of: ${CLAIM_STATUSES.join(', ')}` });
    return;
  }

  const existing = await query('SELECT status, reference FROM claims WHERE id = $1 AND org_id = $2', [id, orgId]);
  if (existing.rows.length === 0) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }
  const current = existing.rows[0];
  if (!canTransition(current.status, status)) {
    res.status(409).json({ error: `Cannot move a ${current.status} claim to ${status}.` });
    return;
  }

  const result = await query(
    `UPDATE claims
        SET status = $1, decision_note = $2, decided_by = $3, decided_at = NOW(), updated_at = NOW()
      WHERE id = $4
      RETURNING *`,
    [status, (note || '').toString(), req.user!.userId, id]
  );

  await recordAudit(req, {
    action: `claim.${status}`, targetType: 'claim', targetId: id,
    targetLabel: current.reference, orgId, metadata: { from: current.status, to: status },
  });

  emitEvent(orgId, 'claim.status_changed', {
    ...claimEventPayload(result.rows[0]),
    previous_status: current.status,
  });

  res.json(result.rows[0]);
}

// POST /claims/:id/documents — attach a supporting file (multipart, field `file`).
// 503 when Storage is not configured so the client can hide the upload affordance.
export async function uploadClaimDocument(req: Request, res: Response): Promise<void> {
  const orgId = req.user!.orgId;
  const id = String(req.params.id);

  if (!storageEnabled) {
    res.status(503).json({ error: 'Document storage is not configured on this server.' });
    return;
  }
  const file = (req as Request & { file?: UploadableFile & { size: number } }).file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const claim = await query('SELECT reference FROM claims WHERE id = $1 AND org_id = $2', [id, orgId]);
  if (claim.rows.length === 0) {
    res.status(404).json({ error: 'Claim not found' });
    return;
  }

  const stored = await uploadClaimFile(id, file);
  const label = (req.body.label ? String(req.body.label) : 'Supporting document').slice(0, 120);

  const result = await query(
    `INSERT INTO claim_documents
       (claim_id, label, file_name, file_url, storage_path, content_type, size_bytes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, label, file_name, file_url, content_type, size_bytes, created_at`,
    [id, label, file.originalname, stored.url, stored.path, file.mimetype || '', file.size || 0]
  );

  await recordAudit(req, {
    action: 'claim.document_add', targetType: 'claim', targetId: id,
    targetLabel: claim.rows[0].reference, orgId, metadata: { fileName: file.originalname },
  });

  res.status(201).json(result.rows[0]);
}
