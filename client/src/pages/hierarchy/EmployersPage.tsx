import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { listChildEmployers, createChildEmployer, type ChildEmployer } from '../../api/hierarchy';

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
            <tr><th>Employer</th><th>Join code</th><th>Members</th><th>Users</th><th>Status</th></tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className={o.is_active ? '' : 'row-inactive'}>
                <td><strong>{o.name}</strong><div className="muted small">{o.slug}</div></td>
                <td><code>{o.join_code}</code></td>
                <td className="muted small">{o.member_count}</td>
                <td className="muted small">{o.user_count}</td>
                <td><span className={`badge ${o.is_active ? 'badge-green' : 'badge-gray'}`}>{o.is_active ? 'active' : 'suspended'}</span></td>
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
