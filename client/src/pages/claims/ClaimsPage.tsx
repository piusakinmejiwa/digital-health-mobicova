import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Claim, ClaimDetail, Enrolment, ClaimAiReview } from '../../types';
import {
  listClaims, getClaim, createClaim, decideClaim, uploadClaimDocument,
  aiReviewClaim, listMembers, listEnrolments,
} from '../../api/resources';
import { naira, formatDate, formatDateTime, badgeClass, claimStatusLabel, fileSize } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import './Claims.css';

const CLAIM_TYPES = [
  'outpatient', 'inpatient', 'pharmacy', 'dental', 'optical',
  'maternity', 'emergency', 'diagnostics', 'other',
];
const typeLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// AI integrity indicator. Decision support only — it flags for a human reviewer.
function AiClaimBadge({ status, risk }: { status?: string; risk?: string }) {
  if (status === 'flagged') {
    return <span className={`ai-claim-badge flagged risk-${risk || 'medium'}`} title="AI flagged this claim for human review">⚑ AI review</span>;
  }
  if (status === 'ok') {
    return <span className="ai-claim-badge ok" title="AI checked — no anomalies found">✓ AI verified</span>;
  }
  return <span className="ai-claim-badge none" title="Not yet reviewed by AI">—</span>;
}

// Adjudication actions available from each status, mirroring the server's state
// machine (lib/claims.ts). Terminal statuses (rejected/paid) offer none.
const NEXT_ACTIONS: Record<string, { status: string; label: string; variant: string }[]> = {
  submitted: [
    { status: 'under_review', label: 'Move to review', variant: 'btn-secondary' },
    { status: 'approved', label: 'Approve', variant: 'btn-primary' },
    { status: 'rejected', label: 'Reject', variant: 'btn-danger' },
  ],
  under_review: [
    { status: 'approved', label: 'Approve', variant: 'btn-primary' },
    { status: 'rejected', label: 'Reject', variant: 'btn-danger' },
  ],
  approved: [
    { status: 'paid', label: 'Mark paid', variant: 'btn-primary' },
    { status: 'rejected', label: 'Reject', variant: 'btn-danger' },
  ],
  rejected: [],
  paid: [],
};

const STATUS_TABS = ['all', 'submitted', 'under_review', 'approved', 'rejected', 'paid'];

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

const emptyClaim = {
  memberId: '', claimType: 'outpatient', providerName: '',
  amount: '', serviceDate: '', description: '', enrolmentId: '',
};

export default function ClaimsPage() {
  const qc = useQueryClient();
  const { canWrite } = useAuth();
  const [tab, setTab] = useState('all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | typeof emptyClaim>(null);

  const { data } = useQuery({
    queryKey: ['claims', tab],
    queryFn: () => listClaims(tab === 'all' ? undefined : tab),
  });

  const counts = (status: string) =>
    data?.counts.find((c) => c.status === status)?.count ?? 0;
  const totalCount = data?.counts.reduce((sum, c) => sum + c.count, 0) ?? 0;

  const visibleClaims = (data?.claims ?? []).filter((c) => !flaggedOnly || c.ai_status === 'flagged');
  const flaggedCount = (data?.claims ?? []).filter((c) => c.ai_status === 'flagged').length;

  const refresh = () => qc.invalidateQueries({ queryKey: ['claims'] });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Claims</h1>
          <p>Members submit, the partner adjudicates. Cover is underwritten by NAICOM-licensed partners — MobiCova runs the workflow and record.</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setCreating({ ...emptyClaim })}>
            + Log a claim
          </button>
        )}
      </div>

      <div className="tabs">
        {STATUS_TABS.map((s) => (
          <button key={s} className={`tab ${tab === s ? 'active' : ''}`} onClick={() => setTab(s)}>
            {s === 'all' ? 'All' : claimStatusLabel(s)}
            <span className="tab-count">{s === 'all' ? totalCount : counts(s)}</span>
          </button>
        ))}
        {flaggedCount > 0 && (
          <button
            className={`tab tab-flagged ${flaggedOnly ? 'active' : ''}`}
            onClick={() => setFlaggedOnly((v) => !v)}
            title="Show only claims the AI flagged for review"
          >
            ⚑ AI-flagged<span className="tab-count">{flaggedCount}</span>
          </button>
        )}
      </div>

      <div className="card">
        {visibleClaims.length === 0 ? (
          <p className="empty-state">
            {flaggedOnly
              ? 'No AI-flagged claims in this view.'
              : tab === 'all' ? 'No claims yet. Log one to start the workflow.' : `No ${claimStatusLabel(tab).toLowerCase()} claims.`}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th><th>Member</th><th>Type</th><th>Provider</th>
                <th>Amount</th><th>Status</th><th>AI</th><th>Submitted</th><th></th>
              </tr>
            </thead>
            <tbody>
              {visibleClaims.map((c: Claim) => (
                <tr key={c.id}>
                  <td><code>{c.reference}</code></td>
                  <td><strong>{c.member_name}</strong></td>
                  <td className="muted small">{typeLabel(c.claim_type)}</td>
                  <td className="muted small">{c.provider_name || '—'}</td>
                  <td>{naira(c.amount, c.currency)}</td>
                  <td><span className={`badge ${badgeClass(c.status)}`}>{claimStatusLabel(c.status)}</span></td>
                  <td><AiClaimBadge status={c.ai_status} risk={c.ai_risk} /></td>
                  <td className="muted small">{formatDate(c.created_at)}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setOpenId(c.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openId && (
        <ClaimDrawer
          id={openId}
          storageEnabled={data?.storageEnabled ?? false}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}

      {creating && (
        <CreateClaimModal
          draft={creating}
          setDraft={setCreating}
          onClose={() => setCreating(null)}
          onCreated={() => { setCreating(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ---- Detail drawer: claim info, documents, adjudication ----
function ClaimDrawer({ id, storageEnabled, onClose, onChanged }: {
  id: string; storageEnabled: boolean; onClose: () => void; onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { canWrite } = useAuth();
  const { data: claim, isLoading } = useQuery<ClaimDetail>({
    queryKey: ['claim', id],
    queryFn: () => getClaim(id),
  });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const reload = () => {
    qc.invalidateQueries({ queryKey: ['claim', id] });
    onChanged();
  };

  const decide = async (status: string) => {
    if ((status === 'rejected') && !note.trim()) {
      setError('Please add a note explaining the rejection.');
      return;
    }
    setBusy(status); setError('');
    try {
      await decideClaim(id, status, note.trim() || undefined);
      setNote('');
      reload();
    } catch (err) {
      setError(errMessage(err, 'Could not update the claim.'));
    } finally { setBusy(''); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy('upload'); setError('');
    try {
      await uploadClaimDocument(id, file);
      reload();
    } catch (err) {
      setError(errMessage(err, 'Could not upload the document.'));
    } finally { setBusy(''); e.target.value = ''; }
  };

  const actions = claim ? (NEXT_ACTIONS[claim.status] || []) : [];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        {isLoading || !claim ? <p className="muted">Loading…</p> : (
          <>
            <div className="claim-head">
              <div>
                <h3>Claim <code>{claim.reference}</code></h3>
                <p className="muted small">{claim.member_name} · {claim.member_email || claim.member_phone || 'no contact'}</p>
              </div>
              <span className={`badge ${badgeClass(claim.status)}`}>{claimStatusLabel(claim.status)}</span>
            </div>

            <div className="claim-grid">
              <Field label="Type" value={typeLabel(claim.claim_type)} />
              <Field label="Amount" value={naira(claim.amount, claim.currency)} />
              <Field label="Provider" value={claim.provider_name || '—'} />
              <Field label="Service date" value={formatDate(claim.service_date)} />
              <Field label="Plan" value={claim.plan_name || 'Not linked to a plan'} />
              <Field label="Underwriter" value={claim.underwriter || '—'} />
              <Field label="Submitted" value={`${formatDateTime(claim.created_at)} · via ${claim.submitted_via}`} />
              {claim.decided_at && (
                <Field label="Decided" value={`${formatDateTime(claim.decided_at)}${claim.decided_by_name ? ` · ${claim.decided_by_name}` : ''}`} />
              )}
            </div>

            {claim.description && (
              <div className="claim-section">
                <span className="claim-label">Description</span>
                <p className="claim-desc">{claim.description}</p>
              </div>
            )}

            {claim.decision_note && (
              <div className="notice">{`Decision note: ${claim.decision_note}`}</div>
            )}

            <ClaimAiPanel claim={claim} canWrite={canWrite} onReviewed={reload} />

            {/* Documents */}
            <div className="claim-section">
              <span className="claim-label">Documents ({claim.documents.length})</span>
              {claim.documents.length === 0 && <p className="muted small">No documents attached.</p>}
              <ul className="doc-list">
                {claim.documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.file_url} target="_blank" rel="noreferrer">{d.label || d.file_name}</a>
                    <span className="muted small">{fileSize(d.size_bytes)}</span>
                  </li>
                ))}
              </ul>
              {canWrite && storageEnabled && (
                <label className="btn btn-secondary btn-sm doc-upload">
                  {busy === 'upload' ? 'Uploading…' : '+ Attach document'}
                  <input type="file" hidden onChange={onFile} disabled={busy === 'upload'} />
                </label>
              )}
              {canWrite && !storageEnabled && (
                <p className="muted small">Document upload is disabled (Supabase Storage not configured on this server).</p>
              )}
            </div>

            {error && <div className="notice notice-error">{error}</div>}

            {/* Adjudication */}
            {canWrite && actions.length > 0 && (
              <div className="claim-section">
                <span className="claim-label">Decision</span>
                <textarea
                  className="claim-note"
                  placeholder="Optional note (required when rejecting)…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
                <div className="claim-actions">
                  {actions.map((a) => (
                    <button key={a.status} className={`btn ${a.variant} btn-sm`} disabled={!!busy} onClick={() => decide(a.status)}>
                      {busy === a.status ? '…' : a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="claim-field">
      <span className="claim-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---- AI integrity review: flags a claim for a human; never adjudicates ----
function ClaimAiPanel({ claim, canWrite, onReviewed }: {
  claim: ClaimDetail; canWrite: boolean; onReviewed: () => void;
}) {
  const [review, setReview] = useState<ClaimAiReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Show a freshly-run review if we have one, else whatever the claim already carries.
  const current: ClaimAiReview | null = review
    ?? (claim.ai_status && claim.ai_status !== 'unreviewed'
      ? {
        ai_status: claim.ai_status,
        ai_risk: (claim.ai_risk || 'low') as ClaimAiReview['ai_risk'],
        ai_reasons: claim.ai_reasons || [],
        ai_rationale: claim.ai_rationale || '',
        ai_model: claim.ai_model || '',
        ai_reviewed_at: claim.ai_reviewed_at || '',
      }
      : null);

  const run = async () => {
    setBusy(true); setErr('');
    try {
      setReview(await aiReviewClaim(claim.id));
      onReviewed();
    } catch (e) {
      setErr(errMessage(e, 'Could not run the AI review.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="claim-section ai-review-panel">
      <div className="ai-review-head">
        <span className="ai-spark" aria-hidden="true">✨</span>
        <span className="claim-label">AI integrity review</span>
        {canWrite && (
          <button className="btn btn-secondary btn-sm ai-review-btn" onClick={run} disabled={busy}>
            {busy ? 'Reviewing…' : current ? 'Re-run' : 'Run AI review'}
          </button>
        )}
      </div>

      {err && <div className="notice notice-error">{err}</div>}

      {current ? (
        <>
          <div className="ai-review-verdict">
            {current.ai_status === 'flagged'
              ? <span className={`ai-claim-badge flagged risk-${current.ai_risk}`}>⚑ Flagged for review · {current.ai_risk} risk</span>
              : <span className="ai-claim-badge ok">✓ AI verified · no anomalies</span>}
          </div>
          {current.ai_reasons.length > 0 && (
            <ul className="ai-review-reasons">
              {current.ai_reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {current.ai_rationale && <p className="ai-review-rationale">{current.ai_rationale}</p>}
          <p className="muted small ai-review-foot">
            AI decision support only — it flags for a human and never approves, rejects or pays a claim.
            {current.ai_reviewed_at && ` Reviewed ${formatDateTime(current.ai_reviewed_at)}.`}
          </p>
        </>
      ) : (
        !busy && (
          <p className="muted small">
            Not yet reviewed. Run an AI check for anomalies — unusual amount, possible duplicate,
            high frequency, or a type/description mismatch.
          </p>
        )
      )}
    </div>
  );
}

// ---- Create claim modal ----
function CreateClaimModal({ draft, setDraft, onClose, onCreated }: {
  draft: typeof emptyClaim;
  setDraft: (d: typeof emptyClaim) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: enrolments } = useQuery({ queryKey: ['enrolments'], queryFn: listEnrolments });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Only offer enrolments that belong to the chosen member.
  const memberEnrolments = (enrolments ?? []).filter((e: Enrolment) => e.member_id === draft.memberId);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await createClaim({
        memberId: draft.memberId,
        claimType: draft.claimType,
        providerName: draft.providerName,
        amount: Number(draft.amount) || 0,
        serviceDate: draft.serviceDate || null,
        description: draft.description,
        enrolmentId: draft.enrolmentId || undefined,
      });
      onCreated();
    } catch (err) {
      setError(errMessage(err, 'Could not log the claim.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Log a claim</h3>
        <p className="muted small">Record a claim on behalf of a member. They can also submit their own from the member portal.</p>
        {error && <div className="notice notice-error">{error}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label>Member</label>
            <select value={draft.memberId} onChange={(e) => setDraft({ ...draft, memberId: e.target.value, enrolmentId: '' })}>
              <option value="">Select member…</option>
              {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Claim type</label>
            <select value={draft.claimType} onChange={(e) => setDraft({ ...draft, claimType: e.target.value })}>
              {CLAIM_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Provider (hospital / clinic / pharmacy)</label>
            <input value={draft.providerName} onChange={(e) => setDraft({ ...draft, providerName: e.target.value })} placeholder="e.g. Reddington Hospital" />
          </div>
          <div className="form-group">
            <label>Amount (₦)</label>
            <input type="number" min="0" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="0" />
          </div>
          <div className="form-group">
            <label>Service date</label>
            <input type="date" value={draft.serviceDate} onChange={(e) => setDraft({ ...draft, serviceDate: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Linked cover (optional)</label>
            <select value={draft.enrolmentId} onChange={(e) => setDraft({ ...draft, enrolmentId: e.target.value })} disabled={!draft.memberId}>
              <option value="">No specific plan</option>
              {memberEnrolments.map((e: Enrolment) => (
                <option key={e.id} value={e.id}>{e.plan_name} ({e.underwriter})</option>
              ))}
            </select>
          </div>
          <div className="form-group form-span-2">
            <label>Description</label>
            <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What was the treatment / reason for the claim?" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !draft.memberId || !draft.amount}>
            {busy ? 'Logging…' : 'Log claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
