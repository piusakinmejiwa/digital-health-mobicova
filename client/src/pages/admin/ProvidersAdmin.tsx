import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { AdminProvider, Partner } from '../../types';
import {
  adminListProviders, adminCreateProvider, adminUpdateProvider,
  adminResetProviderPassword, adminDeleteProvider, adminListPartners,
} from '../../api/admin';
import { uploadBlogImage } from '../../api/blog';

const ROLES = ['doctor', 'pharmacist'] as const;
const ROLE_LABEL: Record<string, string> = { doctor: 'Doctor', pharmacist: 'Pharmacist' };
// Doctors staff clinical (telemedicine) partners; pharmacists staff pharmacies.
const categoryForRole = (role: string) => (role === 'pharmacist' ? 'pharmacy' : 'telemedicine');

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

// Mirror of the server password policy (lib/password.ts) so the UI blocks weak
// passwords before submit. Returns a short reason or null when it passes.
function passwordIssue(pw: string): string | null {
  if (pw.length < 8) return 'at least 8 characters';
  if (!/[a-z]/.test(pw)) return 'a lowercase letter';
  if (!/[A-Z]/.test(pw)) return 'an uppercase letter';
  if (!/[0-9]/.test(pw)) return 'a number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'a symbol';
  return null;
}

const emptyProvider = {
  partnerId: '', fullName: '', email: '', password: '', role: 'doctor', specialty: '', photoUrl: '', phone: '',
};

export default function ProvidersAdmin() {
  const qc = useQueryClient();
  const { data: providers } = useQuery({ queryKey: ['admin-providers'], queryFn: adminListProviders });
  const { data: partners } = useQuery({ queryKey: ['admin-partners'], queryFn: adminListPartners });
  const [creating, setCreating] = useState<null | typeof emptyProvider>(null);
  const [editing, setEditing] = useState<null | AdminProvider>(null);
  const [resetting, setResetting] = useState<null | AdminProvider>(null);
  const [resetPw, setResetPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const clinicalPartners = (partners as Partner[] | undefined)?.filter(
    (p) => p.category === 'telemedicine' || p.category === 'pharmacy') ?? [];
  // Partners valid for a given role (clinics for doctors, pharmacies for pharmacists).
  const partnersForRole = (role: string) => clinicalPartners.filter((p) => p.category === categoryForRole(role));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-providers'] });
    qc.invalidateQueries({ queryKey: ['member-doctors'] });
  };

  const openNew = () => {
    setError('');
    const first = partnersForRole('doctor')[0]?.id ?? '';
    setCreating({ ...emptyProvider, partnerId: first });
  };

  // Switching role re-scopes the partner list, so pick a valid partner for it.
  const setRole = (role: string) => {
    if (!creating) return;
    setCreating({ ...creating, role, partnerId: partnersForRole(role)[0]?.id ?? '' });
  };

  const create = async () => {
    if (!creating) return;
    setBusy(true); setError('');
    try {
      await adminCreateProvider({
        partnerId: creating.partnerId, fullName: creating.fullName.trim(), email: creating.email.trim(),
        password: creating.password, role: creating.role, specialty: creating.specialty.trim(),
        photoUrl: creating.photoUrl.trim(), phone: creating.phone.trim(),
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
        phone: editing.phone ?? '',
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

  const doReset = async () => {
    if (!resetting) return;
    setBusy(true); setError('');
    try {
      await adminResetProviderPassword(resetting.id, resetPw);
      setResetting(null); setResetPw('');
    } catch (err) {
      setError(errMessage(err, 'Could not reset the password.'));
    } finally { setBusy(false); }
  };

  const remove = async (p: AdminProvider) => {
    if (!confirm(`Permanently delete ${p.full_name} (${p.email})? This cannot be undone.`)) return;
    try { await adminDeleteProvider(p.id); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not delete the provider.')); }
  };

  const createPwIssue = creating ? passwordIssue(creating.password) : 'required';

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
              <td><span className={`badge ${p.role === 'doctor' ? 'badge-teal' : 'badge-blue'}`}>{ROLE_LABEL[p.role] ?? p.role}</span></td>
              <td className="muted small">{p.specialty || '—'}</td>
              <td className="muted small">{p.partner_name}</td>
              <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>{p.is_active ? 'active' : 'inactive'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditing(p); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setResetPw(''); setResetting(p); }}>Reset password</button>
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
                <select value={creating.role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Partner ({creating.role === 'pharmacist' ? 'Pharmacy' : 'Clinic'})</label>
                <select value={creating.partnerId} onChange={(e) => setCreating({ ...creating, partnerId: e.target.value })}>
                  {partnersForRole(creating.role).length === 0 && <option value="">No {creating.role === 'pharmacist' ? 'pharmacies' : 'clinics'} yet</option>}
                  {partnersForRole(creating.role).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                <label>Password</label>
                <input type="password" autoComplete="new-password" value={creating.password}
                  onChange={(e) => setCreating({ ...creating, password: e.target.value })} placeholder="Temporary password" />
                {creating.password && createPwIssue
                  ? <span className="muted small">Needs {createPwIssue}.</span>
                  : <span className="muted small">8+ chars with upper &amp; lower case, a number and a symbol.</span>}
              </div>
              {creating.role === 'doctor' && (
                <div className="form-group">
                  <label>Phone (for masked calls)</label>
                  <input value={creating.phone} onChange={(e) => setCreating({ ...creating, phone: e.target.value })} placeholder="+2348012345678" />
                </div>
              )}
              <div className="form-group form-span-2">
                <label>Photo</label>
                <PhotoField value={creating.photoUrl} onChange={(url) => setCreating({ ...creating, photoUrl: url })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreating(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={create}
                disabled={busy || !creating.partnerId || !creating.fullName.trim() || !creating.email.trim() || !!createPwIssue}>
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
                <select value={editing.role} onChange={(e) => {
                  const role = e.target.value as AdminProvider['role'];
                  setEditing({ ...editing, role, partner_id: partnersForRole(role)[0]?.id ?? '' });
                }}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Partner ({editing.role === 'pharmacist' ? 'Pharmacy' : 'Clinic'})</label>
                <select value={editing.partner_id} onChange={(e) => setEditing({ ...editing, partner_id: e.target.value })}>
                  {partnersForRole(editing.role).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
              {editing.role === 'doctor' && (
                <div className="form-group">
                  <label>Phone (for masked calls)</label>
                  <input value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+2348012345678" />
                </div>
              )}
              <div className="form-group form-span-2">
                <label>Photo</label>
                <PhotoField value={editing.photo_url} onChange={(url) => setEditing({ ...editing, photo_url: url })} />
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

      {/* ---- Reset password modal (masked + strict) ---- */}
      {resetting && (
        <div className="drawer-overlay" onClick={() => setResetting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset password</h3>
            <p className="muted small">{resetting.full_name} · {resetting.email}</p>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-group">
              <label>New password</label>
              <input type="password" autoComplete="new-password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New password" />
              {resetPw && passwordIssue(resetPw)
                ? <span className="muted small">Needs {passwordIssue(resetPw)}.</span>
                : <span className="muted small">8+ chars with upper &amp; lower case, a number and a symbol.</span>}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setResetting(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doReset} disabled={busy || !!passwordIssue(resetPw)}>
                {busy ? 'Saving…' : 'Set password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Photo upload — file picker → uploads to storage → stores the returned URL.
// Replaces the old "paste a URL" field.
function PhotoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = async (file: File) => {
    setBusy(true); setErr('');
    try { onChange(await uploadBlogImage(file)); }
    catch { setErr('Upload failed. Use a JPG/PNG under 5 MB.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="provider-photo">
      {value
        ? <img src={value} alt="Provider" className="provider-photo-img" />
        : <div className="provider-photo-ph">No photo</div>}
      <div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? 'Uploading…' : value ? 'Replace photo' : 'Upload photo'}
        </button>
        {value && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange('')}>Remove</button>}
        {err && <span className="muted small" style={{ color: '#b04a4a' }}> {err}</span>}
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
      </div>
    </div>
  );
}
