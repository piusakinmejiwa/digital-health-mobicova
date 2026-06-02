import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMemberClaims, getMemberOverview, submitMemberClaim } from '../../api/member';
import type { Claim } from '../../types';
import { naira, formatDate, badgeClass, claimStatusLabel } from '../../lib/format';
import './Member.css';

const CLAIM_TYPES = [
  'outpatient', 'inpatient', 'pharmacy', 'dental', 'optical', 'maternity', 'emergency', 'diagnostics', 'other',
];

export default function MemberClaimsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['member-claims'], queryFn: getMemberClaims });
  const { data: overview } = useQuery({ queryKey: ['member-overview'], queryFn: getMemberOverview });
  const [showForm, setShowForm] = useState(false);

  const claims = data?.claims || [];

  return (
    <div className="member-page">
      <section className="member-hero">
        <div>
          <h1>My claims</h1>
          <p className="muted">Submit a claim against your cover and track its progress.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>Submit a claim</button>
      </section>

      <section className="member-card">
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : claims.length === 0 ? (
          <p className="muted">No claims yet. Tap “Submit a claim” to log one.</p>
        ) : (
          <div className="member-list">
            {claims.map((c: Claim) => (
              <div key={c.id} className="member-row">
                <div>
                  <strong>{c.reference}</strong>
                  <span className="muted small"> · {c.claim_type} · {c.provider_name || '—'}</span>
                  <div className="muted small">{formatDate(c.service_date || c.created_at)}</div>
                </div>
                <div className="member-row-meta">
                  <span>{naira(c.amount, c.currency)}</span>
                  <span className={`badge ${badgeClass(c.status)}`}>{claimStatusLabel(c.status)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <ClaimForm
          enrolments={overview?.enrolments || []}
          onClose={() => setShowForm(false)}
          onSubmitted={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['member-claims'] });
            qc.invalidateQueries({ queryKey: ['member-me'] });
          }}
        />
      )}
    </div>
  );
}

function ClaimForm({
  enrolments, onClose, onSubmitted,
}: {
  enrolments: { id: string; plan_name: string }[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [claimType, setClaimType] = useState('outpatient');
  const [providerName, setProviderName] = useState('');
  const [amount, setAmount] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [enrolmentId, setEnrolmentId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) { setError('Enter the claim amount.'); return; }
    setBusy(true);
    setError('');
    try {
      await submitMemberClaim({
        claimType,
        providerName,
        amount: Number(amount),
        serviceDate: serviceDate || undefined,
        enrolmentId: enrolmentId || undefined,
        description: description || undefined,
      });
      onSubmitted();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not submit your claim. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="member-modal-backdrop" onClick={onClose}>
      <div className="member-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Submit a claim</h2>
        <div className="form-group">
          <label>Claim type</label>
          <select value={claimType} onChange={(e) => setClaimType(e.target.value)}>
            {CLAIM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Provider / hospital</label>
          <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="e.g. Lagoon Hospital" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Amount (₦)</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25000" />
          </div>
          <div className="form-group">
            <label>Service date</label>
            <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
          </div>
        </div>
        {enrolments.length > 0 && (
          <div className="form-group">
            <label>Against cover (optional)</label>
            <select value={enrolmentId} onChange={(e) => setEnrolmentId(e.target.value)}>
              <option value="">— None —</option>
              {enrolments.map((e) => <option key={e.id} value={e.id}>{e.plan_name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What was the treatment for?" />
        </div>
        {error && <div className="error-text">{error}</div>}
        <div className="member-modal-actions">
          <button className="btn btn-link" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
