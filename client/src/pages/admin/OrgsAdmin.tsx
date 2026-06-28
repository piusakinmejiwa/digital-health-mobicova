import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Organisation, AdminUser, OrgBranding } from '../../types';
import {
  adminGetOrgBranding, adminUpdateOrgBranding,
  adminListOrgs, adminCreateOrg, adminUpdateOrg, adminDeleteOrg,
  adminGetOrgSso, adminUpdateOrgSso,
} from '../../api/admin';
import type { SsoConfigInput } from '../../api/sso';
import SsoConfigEditor from '../../components/sso/SsoConfigEditor';
import OrgOnboardingWizard from '../../components/admin/OrgOnboardingWizard';
import OrgDataModal from '../../components/admin/OrgDataModal';
import OrgReportsModal from '../../components/admin/OrgReportsModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminImpersonateOrg } from '../../api/admin';
import { uploadBlogImage } from '../../api/blog';
import OrgLogo from '../../components/common/OrgLogo';
import { ORG_TYPES, orgTypeLabel, orgClassBadge, orgClassOf } from '../../lib/orgTypes';

// Open a file dialog and resolve to the chosen image (or null).
function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

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
  const { user, impersonate } = useAuth();
  const navigate = useNavigate();

  const viewAsOrg = async (o: Organisation) => {
    try {
      const res = await adminImpersonateOrg(o.id);
      impersonate(res.token);
      navigate('/dashboard');
    } catch {
      setError(`Could not open ${o.name}.`);
    }
  };
  const { data: orgs } = useQuery({ queryKey: ['admin-orgs'], queryFn: adminListOrgs });
  const [creating, setCreating] = useState<null | typeof emptyOrg>(null);
  const [editing, setEditing] = useState<null | (Organisation)>(null);
  const [ssoOrg, setSsoOrg] = useState<null | Organisation>(null);
  const [brandingOrg, setBrandingOrg] = useState<null | Organisation>(null);
  const [onboardingOrg, setOnboardingOrg] = useState<null | Organisation>(null);
  const [dataOrg, setDataOrg] = useState<null | Organisation>(null);
  const [reportsOrg, setReportsOrg] = useState<null | Organisation>(null);
  const [menuOrg, setMenuOrg] = useState<string | null>(null);
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
        member_limit_override: editing.member_limit_override ?? null,
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
                <button className="btn btn-secondary btn-sm" onClick={() => viewAsOrg(o)}>View as org</button>
                <div className="row-menu">
                  <button className="btn btn-secondary btn-sm" title="More actions"
                    onClick={() => setMenuOrg(menuOrg === o.id ? null : o.id)}>⋯</button>
                  {menuOrg === o.id && (
                    <>
                      <div className="row-menu-backdrop" onClick={() => setMenuOrg(null)} />
                      <div className="row-menu-pop" onClick={() => setMenuOrg(null)}>
                        <button onClick={() => { setError(''); setEditing(o); }}>Edit</button>
                        <button onClick={() => setOnboardingOrg(o)}>Onboarding</button>
                        <button onClick={() => setDataOrg(o)}>Members &amp; docs</button>
                        <button onClick={() => setReportsOrg(o)}>Reports</button>
                        <button onClick={() => setBrandingOrg(o)}>Branding</button>
                        <button onClick={() => setSsoOrg(o)}>SSO</button>
                        <button onClick={() => toggleActive(o)} disabled={o.id === user?.orgId}>
                          {o.is_active ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button className="danger" onClick={() => remove(o)} disabled={o.id === user?.orgId}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
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
            <p className="muted small">Step 1 — create the organisation (and, optionally, its first admin user). You’ll then continue to the full onboarding questionnaire (company details, workforce, plans, billing, compliance).</p>
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
              <div className="form-group">
                <label>Member limit override</label>
                <input
                  type="number" min={0}
                  value={editing.member_limit_override ?? ''}
                  onChange={(e) => setEditing({ ...editing, member_limit_override: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Blank = plan default"
                />
                <span className="muted small">Custom member seat cap for this org. Blank uses the plan tier’s limit.</span>
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

      {/* ---- Branding modal ---- */}
      {brandingOrg && <OrgBrandingModal org={brandingOrg} onClose={() => setBrandingOrg(null)} />}
      {onboardingOrg && (
        <OrgOnboardingWizard
          org={onboardingOrg}
          onClose={() => setOnboardingOrg(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['admin-orgs'] })}
        />
      )}
      {dataOrg && (
        <OrgDataModal
          org={dataOrg}
          onClose={() => { setDataOrg(null); qc.invalidateQueries({ queryKey: ['admin-orgs'] }); }}
        />
      )}
      {reportsOrg && (
        <OrgReportsModal org={reportsOrg} onClose={() => setReportsOrg(null)} />
      )}

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
              <li><strong>Next:</strong> complete the full onboarding profile — company details, workforce, eligibility, plans, billing and compliance.</li>
            </ul>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setProvisioned(null)}>Later</button>
              <button
                className="btn btn-primary"
                onClick={() => { const o = provisioned.org; setProvisioned(null); setOnboardingOrg(o); }}
              >
                Continue to onboarding →
              </button>
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

// Platform-admin white-label editor for a tenant — set the partner's display
// name, logo letter, colours, support contact and WhatsApp greeting during
// onboarding, without needing their own login.
const EMPTY_BRANDING: OrgBranding = {
  displayName: '', logoLetter: '', logoUrl: '', primaryColor: '#0a7b7b', accentColor: '#12a3a3',
  supportContact: '', whatsappGreeting: '',
};
function OrgBrandingModal({ org, onClose }: { org: Organisation; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-org-branding', org.id], queryFn: () => adminGetOrgBranding(org.id) });
  const [form, setForm] = useState<OrgBranding>(EMPTY_BRANDING);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (data) setForm(data); }, [data]);

  const set = (k: keyof OrgBranding, v: string) => { setForm({ ...form, [k]: v }); setSaved(false); };
  const save = async () => {
    setBusy(true); setErr('');
    try { await adminUpdateOrgBranding(org.id, form); setSaved(true); qc.invalidateQueries({ queryKey: ['admin-org-branding', org.id] }); }
    catch (e) { setErr(errMessage(e, 'Could not save branding.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Branding · {org.name}</h3>
        <p className="muted small">White-label this tenant — shown on their members' app, branded login and emails.</p>
        {err && <div className="notice notice-error">{err}</div>}
        {isLoading ? <p className="muted">Loading…</p> : (
          <>
            <div className="form-grid">
              <div className="form-group">
                <label>Display name</label>
                <input value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="e.g. AXA Mansard Health" />
              </div>
              <div className="form-group">
                <label>Logo letter(s) <span className="muted">— fallback</span></label>
                <input value={form.logoLetter} onChange={(e) => set('logoLetter', e.target.value)} maxLength={4} placeholder="e.g. AX" />
              </div>
              <div className="form-group form-span-2">
                <label>Logo image</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <OrgLogo url={form.logoUrl} letter={form.logoLetter} name={form.displayName} color={form.primaryColor} size={48} />
                  <button className="btn btn-secondary btn-sm" disabled={busy} onClick={async () => {
                    const f = await pickImage(); if (!f) return;
                    setBusy(true); setErr('');
                    try { const url = await uploadBlogImage(f); set('logoUrl', url); }
                    catch (e) { setErr(errMessage(e, 'Upload failed.')); }
                    finally { setBusy(false); }
                  }}>Upload logo</button>
                  {form.logoUrl && <button className="btn btn-ghost btn-sm" onClick={() => set('logoUrl', '')}>Remove</button>}
                </div>
              </div>
              <div className="form-group">
                <label>Primary colour</label>
                <input type="color" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Accent colour</label>
                <input type="color" value={form.accentColor} onChange={(e) => set('accentColor', e.target.value)} />
              </div>
              <div className="form-group form-span-2">
                <label>Support contact</label>
                <input value={form.supportContact} onChange={(e) => set('supportContact', e.target.value)} placeholder="e.g. support@axamansard.com or 0800…" />
              </div>
              <div className="form-group form-span-2">
                <label>WhatsApp greeting</label>
                <textarea rows={2} value={form.whatsappGreeting} onChange={(e) => set('whatsappGreeting', e.target.value)} placeholder="Welcome message shown to members on WhatsApp" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save branding'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
