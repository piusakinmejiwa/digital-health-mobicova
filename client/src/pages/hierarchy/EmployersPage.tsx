import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  listChildEmployers, createChildEmployer, type ChildEmployer,
  listAssignablePlans, listEmployerAssignments, assignPlan, unassignPlan,
} from '../../api/hierarchy';

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

const emptyForm = { name: '', adminFullName: '', adminEmail: '', adminPassword: '' };

// HMO / insurer onboarding console — manage the employer organisations beneath us.
export default function EmployersPage() {
  const qc = useQueryClient();
  const { data: employers } = useQuery({ queryKey: ['child-employers'], queryFn: listChildEmployers });
  const [creating, setCreating] = useState<null | typeof emptyForm>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provisioned, setProvisioned] = useState<null | (ChildEmployer & { admin_user?: { email: string } })>(null);
  const [plansFor, setPlansFor] = useState<null | ChildEmployer>(null);

  const list = employers ?? [];

  const create = async () => {
    if (!creating) return;
    setBusy(true); setError('');
    try {
      const payload: { name: string; adminEmail?: string; adminFullName?: string; adminPassword?: string } = { name: creating.name.trim() };
      if (creating.adminEmail.trim()) {
        payload.adminEmail = creating.adminEmail.trim();
        payload.adminFullName = creating.adminFullName.trim();
        payload.adminPassword = creating.adminPassword;
      }
      const created = await createChildEmployer(payload);
      setCreating(null);
      qc.invalidateQueries({ queryKey: ['child-employers'] });
      setProvisioned(created);
    } catch (err) {
      setError(errMessage(err, 'Could not onboard the employer.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Employers</h1>
          <p>Onboard and manage the employer organisations covered under your plans.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setCreating({ ...emptyForm }); }}>
          + Onboard employer
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Employer</th><th>Join code</th><th>Members</th><th>Users</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className={o.is_active ? '' : 'row-inactive'}>
                <td><strong>{o.name}</strong><div className="muted small">{o.slug}</div></td>
                <td><code>{o.join_code}</code></td>
                <td className="muted small">{o.member_count}</td>
                <td className="muted small">{o.user_count}</td>
                <td><span className={`badge ${o.is_active ? 'badge-green' : 'badge-gray'}`}>{o.is_active ? 'active' : 'suspended'}</span></td>
                <td className="admin-actions"><button className="btn btn-secondary btn-sm" onClick={() => setPlansFor(o)}>Plans</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="empty-state">No employers yet. Onboard one to start enrolling their staff.</p>}
      </div>

      {creating && (
        <div className="drawer-overlay" onClick={() => setCreating(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Onboard employer</h3>
            <p className="muted small">Creates an employer organisation under your HMO. You can add an admin now or later.</p>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group form-span-2">
                <label>Employer name</label>
                <input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="e.g. Zenith Bank Plc" />
              </div>
              <div className="form-group form-span-2">
                <label className="admin-section-label">First admin user (optional)</label>
                <p className="muted small">Leave blank to create the employer only — add users later.</p>
              </div>
              <div className="form-group">
                <label>Admin full name</label>
                <input value={creating.adminFullName} onChange={(e) => setCreating({ ...creating, adminFullName: e.target.value })} placeholder="e.g. Ada Obi" />
              </div>
              <div className="form-group">
                <label>Admin email</label>
                <input value={creating.adminEmail} onChange={(e) => setCreating({ ...creating, adminEmail: e.target.value })} placeholder="hr@employer.com" />
              </div>
              <div className="form-group form-span-2">
                <label>Admin password {creating.adminEmail.trim() ? '(optional — min 8 characters)' : ''}</label>
                <input type="text" value={creating.adminPassword} onChange={(e) => setCreating({ ...creating, adminPassword: e.target.value })} placeholder="Leave blank to email a set-password link" disabled={!creating.adminEmail.trim()} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreating(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={busy || !creating.name.trim()}>
                {busy ? 'Onboarding…' : 'Onboard employer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {plansFor && <PlanAssignmentsModal employer={plansFor} onClose={() => setPlansFor(null)} />}

      {provisioned && (
        <div className="drawer-overlay" onClick={() => setProvisioned(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Employer onboarded</h3>
            <p><strong>{provisioned.name}</strong> is live under your organisation.</p>
            <ul className="provisioned-summary">
              <li>Join code: <code>{provisioned.join_code}</code> — their staff type this on WhatsApp/USSD to enrol.</li>
              {provisioned.admin_user
                ? <li>Admin login: <code>{provisioned.admin_user.email}</code> — they’ll get a welcome email with a sign-in (and set-password) link.</li>
                : <li className="muted">No admin user was created — add one later.</li>}
            </ul>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setProvisioned(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Manage the plans assigned to one employer — assign a plan the org owns, at the
// list price or a negotiated group premium, and remove assignments.
function PlanAssignmentsModal({ employer, onClose }: { employer: ChildEmployer; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: assignments } = useQuery({ queryKey: ['emp-plans', employer.id], queryFn: () => listEmployerAssignments(employer.id) });
  const { data: plans } = useQuery({ queryKey: ['assignable-plans'], queryFn: listAssignablePlans });
  const [planId, setPlanId] = useState('');
  const [premium, setPremium] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['emp-plans', employer.id] });

  const assigned = assignments ?? [];
  const available = (plans ?? []).filter((p) => !assigned.some((a) => a.plan_id === p.id));

  const add = async () => {
    if (!planId) return;
    setBusy(true); setError('');
    try {
      await assignPlan(employer.id, { planId, negotiatedPremium: premium.trim() || null });
      setPlanId(''); setPremium(''); refresh();
    } catch (err) { setError(errMessage(err, 'Could not assign the plan.')); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this plan assignment?')) return;
    try { await unassignPlan(employer.id, id); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not remove.')); }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Plans · {employer.name}</h3>
        <p className="muted small">Assign the plans you offer to this employer. Leave the premium blank to use the plan’s list price, or enter a negotiated group premium.</p>
        {error && <div className="notice notice-error">{error}</div>}

        <table className="table">
          <thead><tr><th>Plan</th><th>Kind</th><th>Premium</th><th></th></tr></thead>
          <tbody>
            {assigned.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.plan_name}</strong></td>
                <td className="muted small">{a.kind}</td>
                <td>
                  {Number(a.effective_premium).toLocaleString()} {a.currency}/mo
                  {a.negotiated_premium != null && <span className="muted small"> (negotiated)</span>}
                </td>
                <td className="admin-actions"><button className="btn btn-danger btn-sm" onClick={() => remove(a.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {assigned.length === 0 && <p className="empty-state">No plans assigned yet.</p>}

        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="form-group">
            <label>Add a plan</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">— choose a plan —</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Negotiated premium <span className="muted">— optional</span></label>
            <input type="number" min={0} value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="Blank = list price" />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={add} disabled={busy || !planId}>{busy ? 'Assigning…' : 'Assign plan'}</button>
        </div>
      </div>
    </div>
  );
}
