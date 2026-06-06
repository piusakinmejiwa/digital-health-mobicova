import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { getSupplyOverview, getSupplyStaff, addSupplyStaff, setSupplyStaffActive } from '../../api/supply';
import './Supply.css';

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

// Supply-org admin self-service: manage the org's own clinicians (doctors for a
// clinic, pharmacists for a pharmacy). Role is inferred from the org type.
export default function SupplyStaffPage() {
  const qc = useQueryClient();
  const { data: overview } = useQuery({ queryKey: ['supply-overview'], queryFn: getSupplyOverview });
  const { data } = useQuery({ queryKey: ['supply-staff'], queryFn: getSupplyStaff });
  const staff = data?.staff ?? [];
  const isPharmacy = overview?.type === 'pharmacy';
  const roleLabel = isPharmacy ? 'Pharmacist' : 'Doctor';

  const [form, setForm] = useState({ fullName: '', email: '', password: '', specialty: '' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['supply-staff'] });
    qc.invalidateQueries({ queryKey: ['supply-overview'] });
  };

  const add = async () => {
    setBusy(true); setError('');
    try {
      await addSupplyStaff(form);
      setForm({ fullName: '', email: '', password: '', specialty: '' });
      setOpen(false);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not add the clinician.'));
    } finally { setBusy(false); }
  };

  const toggle = async (id: string, isActive: boolean) => {
    try {
      await setSupplyStaffActive(id, isActive);
      refresh();
    } catch (err) {
      alert(errMessage(err, 'Could not update the clinician.'));
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Staff</h1>
        <p className="muted">{overview?.name ? `${overview.name} · ` : ''}{roleLabel.toLowerCase()}s at your organisation</p>
      </div>

      <div className="card">
        <div className="admin-toolbar">
          <span className="muted small">{staff.length} {roleLabel.toLowerCase()}{staff.length === 1 ? '' : 's'}</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setError(''); setOpen(true); }}>+ Add {roleLabel.toLowerCase()}</button>
        </div>
        {staff.length === 0 ? (
          <p className="empty-state">No {roleLabel.toLowerCase()}s yet. Add one so they can sign in to the Provider portal.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Specialty</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className={s.is_active ? '' : 'row-inactive'}>
                  <td><strong>{s.full_name}</strong></td>
                  <td className="muted small">{s.email}</td>
                  <td className="muted small">{s.specialty || '—'}</td>
                  <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? 'active' : 'inactive'}</span></td>
                  <td className="admin-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => toggle(s.id, !s.is_active)}>
                      {s.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add {roleLabel.toLowerCase()}</h3>
            <p className="muted small">They’ll sign in at the Provider portal with the password you set.</p>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-group">
              <label>Full name</label>
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder={isPharmacy ? 'e.g. Pharm. Bode Adesina' : 'e.g. Dr. Adaeze Okonkwo'} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@organisation.com" />
            </div>
            {!isPharmacy && (
              <div className="form-group">
                <label>Specialty</label>
                <input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} placeholder="e.g. General Practice" />
              </div>
            )}
            <div className="form-group">
              <label>Temporary password (min 8 characters)</label>
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set a password" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={add} disabled={busy || !form.fullName.trim() || !form.email.trim()}>
                {busy ? 'Adding…' : `Add ${roleLabel.toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
