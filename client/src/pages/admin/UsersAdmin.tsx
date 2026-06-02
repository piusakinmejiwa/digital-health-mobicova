import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { AdminUser, Organisation } from '../../types';
import {
  adminListUsers, adminCreateUser, adminUpdateUser,
  adminResetUserPassword, adminDeleteUser, adminListOrgs,
} from '../../api/admin';
import { useAuth } from '../../context/AuthContext';

// Per-tenant roles (independent of platform-admin). Order = most → least privilege.
const ROLES = ['admin', 'manager', 'analyst'] as const;
const ROLE_HELP: Record<string, string> = {
  admin: 'Full control of the organisation, including its users and billing.',
  manager: 'Manage members and services (telemedicine, insurance, triage). No user or billing admin.',
  analyst: 'Read-only access to the organisation’s data.',
};

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

const emptyUser = {
  orgId: '', email: '', fullName: '', password: '', role: 'admin', isPlatformAdmin: false,
};

export default function UsersAdmin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: users } = useQuery({ queryKey: ['admin-users'], queryFn: () => adminListUsers() });
  const { data: orgs } = useQuery({ queryKey: ['admin-orgs'], queryFn: adminListOrgs });
  const [creating, setCreating] = useState<null | typeof emptyUser>(null);
  const [editing, setEditing] = useState<null | AdminUser>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users'] });

  const openNew = () => {
    setError('');
    setCreating({ ...emptyUser, orgId: orgs?.[0]?.id ?? '' });
  };

  const create = async () => {
    if (!creating) return;
    setBusy(true); setError('');
    try {
      await adminCreateUser({
        orgId: creating.orgId, email: creating.email.trim(), fullName: creating.fullName.trim(),
        password: creating.password, role: creating.role, isPlatformAdmin: creating.isPlatformAdmin,
      });
      setCreating(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not create the user.'));
    } finally { setBusy(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      await adminUpdateUser(editing.id, {
        full_name: editing.full_name, role: editing.role,
        is_active: editing.is_active, is_platform_admin: editing.is_platform_admin,
      });
      setEditing(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not update the user.'));
    } finally { setBusy(false); }
  };

  const toggleActive = async (u: AdminUser) => {
    try {
      await adminUpdateUser(u.id, { is_active: !u.is_active });
      refresh();
    } catch (err) {
      alert(errMessage(err, 'Could not update the user.'));
    }
  };

  const resetPassword = async (u: AdminUser) => {
    const pw = prompt(`Set a new password for ${u.email} (min 8 characters):`);
    if (pw == null) return;
    if (pw.length < 8) { alert('Password must be at least 8 characters.'); return; }
    try {
      await adminResetUserPassword(u.id, pw);
      alert(`Password updated for ${u.email}.`);
    } catch (err) {
      alert(errMessage(err, 'Could not reset the password.'));
    }
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return;
    try {
      await adminDeleteUser(u.id);
      refresh();
    } catch (err) {
      alert(errMessage(err, 'Could not delete the user.'));
    }
  };

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{users?.length ?? 0} users</span>
        <button className="btn btn-primary btn-sm" onClick={openNew} disabled={!orgs || orgs.length === 0}>+ New user</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Organisation</th><th>Role</th><th>Platform admin</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className={u.is_active ? '' : 'row-inactive'}>
              <td><strong>{u.full_name}</strong>{u.id === user?.id && <span className="badge badge-blue" style={{ marginLeft: 6 }}>you</span>}</td>
              <td className="muted small">{u.email}</td>
              <td className="muted small">{u.org_name}</td>
              <td className="muted small">{u.role}</td>
              <td>{u.is_platform_admin ? <span className="badge badge-green">yes</span> : <span className="muted small">—</span>}</td>
              <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>{u.is_active ? 'active' : 'inactive'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditing(u); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => resetPassword(u)}>Reset password</button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleActive(u)}
                  disabled={u.id === user?.id}
                  title={u.id === user?.id ? 'You cannot deactivate your own account' : ''}
                >
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => remove(u)}
                  disabled={u.id === user?.id}
                  title={u.id === user?.id ? 'You cannot delete your own account' : ''}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!users || users.length === 0) && <p className="empty-state">No users yet.</p>}

      {/* ---- Create modal ---- */}
      {creating && (
        <div className="drawer-overlay" onClick={() => setCreating(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>New user</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Organisation</label>
                <select value={creating.orgId} onChange={(e) => setCreating({ ...creating, orgId: e.target.value })}>
                  {(orgs as Organisation[] | undefined)?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="muted small">{ROLE_HELP[creating.role]}</span>
              </div>
              <div className="form-group">
                <label>Full name</label>
                <input value={creating.fullName} onChange={(e) => setCreating({ ...creating, fullName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label>Password (min 8 characters)</label>
                <input type="text" value={creating.password} onChange={(e) => setCreating({ ...creating, password: e.target.value })} placeholder="Set a temporary password" />
              </div>
              <div className="form-group form-span-2">
                <label className="checkbox-row">
                  <input type="checkbox" checked={creating.isPlatformAdmin} onChange={(e) => setCreating({ ...creating, isPlatformAdmin: e.target.checked })} />
                  <span>Grant platform-admin access (can manage the catalog, organisations and users)</span>
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreating(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={busy || !creating.orgId || !creating.email.trim() || !creating.fullName.trim() || creating.password.length < 8}>
                {busy ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit modal ---- */}
      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Edit user</h3>
            <p className="muted small">{editing.email} · {editing.org_name}</p>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Full name</label>
                <input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <span className="muted small">{ROLE_HELP[editing.role]}</span>
              </div>
              <div className="form-group form-span-2">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={editing.is_platform_admin}
                    disabled={editing.id === user?.id}
                    onChange={(e) => setEditing({ ...editing, is_platform_admin: e.target.checked })}
                  />
                  <span>Platform-admin access{editing.id === user?.id ? ' (you cannot remove your own)' : ''}</span>
                </label>
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
