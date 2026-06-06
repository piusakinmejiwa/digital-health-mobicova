import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { AdminProvider, Partner } from '../../types';
import {
  adminListProviders, adminCreateProvider, adminUpdateProvider,
  adminResetProviderPassword, adminDeleteProvider, adminListPartners,
} from '../../api/admin';

const ROLES = ['doctor', 'pharmacist'] as const;
// Providers staff clinical / pharmacy partners.
const PROVIDER_PARTNER_CATEGORIES = ['telemedicine', 'pharmacy'];

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

const emptyProvider = {
  partnerId: '', fullName: '', email: '', password: '', role: 'doctor', specialty: '', photoUrl: '',
};

export default function ProvidersAdmin() {
  const qc = useQueryClient();
  const { data: providers } = useQuery({ queryKey: ['admin-providers'], queryFn: adminListProviders });
  const { data: partners } = useQuery({ queryKey: ['admin-partners'], queryFn: adminListPartners });
  const [creating, setCreating] = useState<null | typeof emptyProvider>(null);
  const [editing, setEditing] = useState<null | AdminProvider>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const clinicalPartners = (partners as Partner[] | undefined)?.filter((p) => PROVIDER_PARTNER_CATEGORIES.includes(p.category)) ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-providers'] });
    qc.invalidateQueries({ queryKey: ['member-doctors'] }); // member "talk to a doctor" list
  };

  const openNew = () => {
    setError('');
    setCreating({ ...emptyProvider, partnerId: clinicalPartners[0]?.id ?? '' });
  };

  const create = async () => {
    if (!creating) return;
    setBusy(true); setError('');
    try {
      await adminCreateProvider({
        partnerId: creating.partnerId, fullName: creating.fullName.trim(), email: creating.email.trim(),
        password: creating.password, role: creating.role, specialty: creating.specialty.trim(), photoUrl: creating.photoUrl.trim(),
      });
      setCreating(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not create the provider.'));
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      await adminUpdateProvider(editing.id, {
        partnerId: editing.partner_id, fullName: editing.full_name, role: editing.role,
        specialty: editing.specialty, photoUrl: editing.photo_url, is_active: editing.is_active,
      });
      setEditing(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not update the provider.'));
    } finally { setBusy(false); }
  };

  const toggleActive = async (p: AdminProvider) => {
    try { await adminUpdateProvider(p.id, { is_active: !p.is_active }); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not update the provider.')); }
  };

  const resetPassword = async (p: AdminProvider) => {
    const pw = prompt(`Set a new password for ${p.email} (min 8 characters):`);
    if (pw == null) return;
    if (pw.length < 8) { alert('Password must be at least 8 characters.'); return; }
    try { await adminResetProviderPassword(p.id, pw); alert(`Password updated for ${p.email}.`); }
    catch (err) { alert(errMessage(err, 'Could not reset the password.')); }
  };

  const remove = async (p: AdminProvider) => {
    if (!confirm(`Permanently delete ${p.full_name} (${p.email})? This cannot be undone.`)) return;
    try { await adminDeleteProvider(p.id); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not delete the provider.')); }
  };

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{providers?.length ?? 0} providers</span>
        <button className="btn btn-primary btn-sm" onClick={openNew} disabled={clinicalPartners.length === 0}>+ Add a provider</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Specialty</th><th>Partner</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {providers?.map((p) => (
            <tr key={p.id} className={p.is_active ? '' : 'row-inactive'}>
              <td><strong>{p.full_name}</strong></td>
              <td className="muted small">{p.email}</td>
              <td><span className={`badge ${p.role === 'doctor' ? 'badge-teal' : 'badge-blue'}`}>{p.role}</span></td>
              <td className="muted small">{p.specialty || '—'}</td>
              <td className="muted small">{p.partner_name}</td>
              <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>{p.is_active ? 'active' : 'inactive'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditing(p); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => resetPassword(p)}>Reset password</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!providers || providers.length === 0) && <p className="empty-state">No providers yet. Add a doctor or pharmacist to get started.</p>}
      {clinicalPartners.length === 0 && (
        <p className="empty-state">Add a telemedicine or pharmacy partner first (Partners tab) — providers belong to one.</p>
      )}

      {/* ---- Create modal ---- */}
      {creating && (
        <div className="drawer-overlay" onClick={() => setCreating(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Add a provider</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Role</label>
                <select value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Partner (clinic / pharmacy)</label>
                <select value={creating.partnerId} onChange={(e) => setCreating({ ...creating, partnerId: e.target.value })}>
                  {clinicalPartners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Full name</label>
                <input value={creating.fullName} onChange={(e) => setCreating({ ...creating, fullName: e.target.value })} placeholder="e.g. Dr. Chidi Okeke" />
              </div>
              <div className="form-group">
                <label>Specialty</label>
                <input value={creating.specialty} onChange={(e) => setCreating({ ...creating, specialty: e.target.value })} placeholder="e.g. Cardiology" />
              </div>
              <div className="form-group">
                <label>Email (login)</label>
                <input value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Password (min 8 characters)</label>
                <input type="text" value={creating.password} onChange={(e) => setCreating({ ...creating, password: e.target.value })} placeholder="Temporary password" />
              </div>
              <div className="form-group form-span-2">
                <label>Photo URL (optional)</label>
                <input value={creating.photoUrl} onChange={(e) => setCreating({ ...creating, photoUrl: e.target.value })} placeholder="/images/doctor.jpg or https://…" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreating(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={busy || !creating.partnerId || !creating.fullName.trim() || !creating.email.trim() || creating.password.length < 8}>
                {busy ? 'Adding…' : 'Add provider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit modal ---- */}
      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit provider</h3>
            <p className="muted small">{editing.email}</p>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Role</label>
                <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as AdminProvider['role'] })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Partner (clinic / pharmacy)</label>
                <select value={editing.partner_id} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value })}>
                  {clinicalPartners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Full name</label>
                <input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Specialty</label>
                <input value={editing.specialty} onChange={(e) => setEditing({ ...editing, specialty: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label>Photo URL</label>
                <input value={editing.photo_url} onChange={(e) => setEditing({ ...editing, photo_url: e.target.value })} placeholder="/images/doctor.jpg or https://…" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={busy || !editing.full_name.trim()}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
