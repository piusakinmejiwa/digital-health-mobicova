import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Organisation, AdminUser } from '../../types';
import {
  adminListOrgs, adminCreateOrg, adminUpdateOrg, adminDeleteOrg,
  adminGetOrgSso, adminUpdateOrgSso,
} from '../../api/admin';
import type { SsoConfigInput } from '../../api/sso';
import SsoConfigEditor from '../../components/sso/SsoConfigEditor';
import { useAuth } from '../../context/AuthContext';
import { ORG_TYPES, orgTypeLabel, orgClassBadge, orgClassOf } from '../../lib/orgTypes';

const PLAN_TIERS = ['starter', 'growth', 'scale', 'enterprise'];

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

const emptyOrg = {
  name: '', type: 'company', planTier: 'starter', country: 'Nigeria',
  adminEmail: '', adminFullName: '', adminPassword: '',
};

export default function OrgsAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: orgs } = useQuery({ queryKey: ['admin-orgs'], queryFn: adminListOrgs });
  const [creating, setCreating] = useState<null | typeof emptyOrg>(null);
  const [editing, setEditing] = useState<null | (Organisation)>(null);
  const [ssoOrg, setSsoOrg] = useState<null | Organisation>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provisioned, setProvisioned] = useState<null | { org: Organisation; admin?: AdminUser }>(null);
  const [typeFilter, setTypeFilter] = useState('');

  const allOrgs = orgs ?? [];
  const filtered = typeFilter ? allOrgs.filter((o) => o.type === typeFilter) : allOrgs;
  // Count organisations per type, for the filter dropdown + summary.
  const countsByType = allOrgs.reduce<Record<string, number>>((acc, o) => {
    acc[o.type] = (acc[o.type] || 0) + 1;
    return acc;
  }, {});

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-orgs'] });
    qc.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const openNew = () => { setError(''); setCreating({ ...emptyOrg }); };

  const create = async () => {
    if (!creating) return;
    setBusy(true); setError('');
    const payload: Record<string, unknown> = {
      name: creating.name, type: creating.type,
      planTier: creating.planTier, country: creating.country,
    };
    // Only send admin fields when an email is provided (provisioning the first user).
    if (creating.adminEmail.trim()) {
      payload.adminEmail = creating.adminEmail.trim();
      payload.adminFullName = creating.adminFullName.trim();
      payload.adminPassword = creating.adminPassword;
    }
    try {
      const created = await adminCreateOrg(payload);
      setCreating(null);
      refresh();
      setProvisioned({ org: created, admin: created.admin_user });
    } catch (err) {
      setError(errMessage(err, 'Could not create the organisation.'));
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      await adminUpdateOrg(editing.id, {
        name: editing.name, type: editing.type,
        plan_tier: editing.plan_tier, country: editing.country,
        address: editing.address ?? '', city: editing.city ?? '',
      });
      setEditing(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not update the organisation.'));
    } finally { setBusy(false); }
  };

  const toggleActive = async (o: Organisation) => {
    try {
      await adminUpdateOrg(o.id, { is_active: !o.is_active });
      refresh();
    } catch (err) {
      alert(errMessage(err, 'Could not update the organisation.'));
    }
  };

  const remove = async (o: Organisation) => {
    if (!confirm(`Permanently delete "${o.name}"? This cannot be undone.`)) return;
    try {
      await adminDeleteOrg(o.id);
      refresh();
    } catch (err) {
      alert(errMessage(err, 'Could not delete the organisation.'));
    }
  };

  return (
    <div className="card">
      <div className="admin-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="muted small">
            {filtered.length} of {allOrgs.length} organisation{allOrgs.length === 1 ? '' : 's'}
          </span>
          <select
            className="admin-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {ORG_TYPES.filter((t) => countsByType[t]).map((t) => (
              <option key={t} value={t}>{orgTypeLabel(t)} ({countsByType[t]})</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Onboard organisation</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>Tier</th><th>Join code</th><th>Members</th><th>Users</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id} className={o.is_active ? '' : 'row-inactive'}>
              <td><strong>{o.name}</strong><div className="muted small">{o.slug}</div></td>
              <td>
                <span className={`badge ${orgClassBadge(o.type)}`}>{orgTypeLabel(o.type)}</span>
                <div className="muted small">{orgClassOf(o.type)}</div>
              </td>
              <td className="muted small">{o.plan_tier}</td>
              <td><code>{o.join_code}</code></td>
              <td className="muted small">{o.member_count}</td>
              <td className="muted small">{o.user_count}</td>
              <td><span className={`badge ${o.is_active ? 'badge-green' : 'badge-gray'}`}>{o.is_active ? 'active' : 'suspended'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditing(o); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSsoOrg(o)}>SSO</button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleActive(o)}
                  disabled={o.id === user?.orgId}
                  title={o.id === user?.orgId ? 'You cannot suspend your own organisation' : ''}
                >
                  {o.is_active ? 'Suspend' : 'Reactivate'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => remove(o)}
                  disabled={o.id === user?.orgId}
                  title={o.id === user?.orgId ? 'You cannot delete your own organisation' : ''}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {allOrgs.length === 0 && <p className="empty-state">No organisations yet. Onboard one to get started.</p>}
      {allOrgs.length > 0 && filtered.length === 0 && (
        <p className="empty-state">No {orgTypeLabel(typeFilter).toLowerCase()} organisations yet.</p>
      )}

      {/* ---- Onboard (create) modal ---- */}
      {creating && (
        <div className="drawer-overlay" onClick={() => setCreating(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Onboard organisation</h3>
            <p className="muted small">Create any organisation — underwriter, company, telco, clinic or pharmacy — and, optionally, its first admin user in one step.</p>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Organisation name</label>
                <input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} placeholder="e.g. Leadway Assurance" />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input value={creating.country} onChange={(e) => setCreating({ ...creating, country: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Organisation type</label>
                <select value={creating.type} onChange={(e) => setCreating({ ...creating, type: e.target.value })}>
                  {ORG_TYPES.map((t) => <option key={t} value={t}>{orgTypeLabel(t)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Plan tier</label>
                <select value={creating.planTier} onChange={(e) => setCreating({ ...creating, planTier: e.target.value })}>
                  {PLAN_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group form-span-2">
                <label className="admin-section-label">First admin user (optional)</label>
                <p className="muted small">Leave blank to create the organisation only — you can add users later.</p>
              </div>
              <div className="form-group">
                <label>Admin full name</label>
                <input value={creating.adminFullName} onChange={(e) => setCreating({ ...creating, adminFullName: e.target.value })} placeholder="e.g. Ada Obi" />
              </div>
              <div className="form-group">
                <label>Admin email</label>
                <input value={creating.adminEmail} onChange={(e) => setCreating({ ...creating, adminEmail: e.target.value })} placeholder="admin@partner.com" />
              </div>
              <div className="form-group form-span-2">
                <label>Admin password {creating.adminEmail.trim() ? '(optional — min 8 characters)' : ''}</label>
                <input type="text" value={creating.adminPassword} onChange={(e) => setCreating({ ...creating, adminPassword: e.target.value })} placeholder="Leave blank to email a set-password link" disabled={!creating.adminEmail.trim()} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreating(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={busy || !creating.name.trim()}>
                {busy ? 'Creating…' : 'Create organisation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit modal ---- */}
      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit organisation</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Organisation name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Organisation type</label>
                <select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  {ORG_TYPES.map((t) => <option key={t} value={t}>{orgTypeLabel(t)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Plan tier</label>
                <select value={editing.plan_tier} onChange={(e) => setEditing({ ...editing, plan_tier: e.target.value })}>
                  {PLAN_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {editing.type === 'pharmacy' && (
                <>
                  <div className="form-group form-span-2">
                    <label>Address (geocoded to route prescriptions to the nearest pharmacy)</label>
                    <input value={editing.address ?? ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} placeholder="e.g. 12 Awolowo Rd, Ikoyi" />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input value={editing.city ?? ''} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="e.g. Lagos" />
                  </div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={busy || !editing.name.trim()}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- SSO config modal ---- */}
      {ssoOrg && <OrgSsoModal org={ssoOrg} onClose={() => setSsoOrg(null)} />}

      {/* ---- Provisioned confirmation ---- */}
      {provisioned && (
        <div className="drawer-overlay" onClick={() => setProvisioned(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Organisation created</h3>
            <p><strong>{provisioned.org.name}</strong> is live.</p>
            <ul className="provisioned-summary">
              <li>Join code: <code>{provisioned.org.join_code}</code> — members type this on WhatsApp/USSD to enrol.</li>
              {provisioned.admin
                ? <li>Admin login: <code>{provisioned.admin.email}</code> — they’ll get a welcome email with their branded sign-in link (and a “set your password” link if you left the password blank).</li>
                : <li className="muted">No admin user was created. Add one from the Users tab when ready.</li>}
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

// Platform-admin SSO editor for a single tenant. Loads the org's current config
// lazily when opened and saves via the admin endpoint.
function OrgSsoModal({ org, onClose }: { org: Organisation; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-org-sso', org.id],
    queryFn: () => adminGetOrgSso(org.id),
  });
  const save = (input: SsoConfigInput) => adminUpdateOrgSso(org.id, input);

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Single sign-on · {org.name}</h3>
        <p className="muted small">Configure SAML SSO on behalf of this partner tenant.</p>
        {isLoading ? <p className="muted">Loading…</p> : <SsoConfigEditor config={data ?? null} onSave={save} />}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
