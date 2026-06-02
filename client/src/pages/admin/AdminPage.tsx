import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Partner, InsurancePlan } from '../../types';
import {
  adminListPartners, adminCreatePartner, adminUpdatePartner, adminDeletePartner,
  adminListPlans, adminCreatePlan, adminUpdatePlan, adminDeletePlan,
} from '../../api/admin';
import { naira } from '../../lib/format';
import OrgsAdmin from './OrgsAdmin';
import UsersAdmin from './UsersAdmin';
import './Admin.css';

const PLAN_TYPES = ['individual', 'family', 'hospital_cash', 'group', 'wellness'];
const PARTNER_CATEGORIES = ['telemedicine', 'insurer', 'pharmacy', 'diagnostics', 'ehr', 'distribution'];

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

type AdminTab = 'organisations' | 'users' | 'plans' | 'partners';

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('organisations');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Platform admin</h1>
          <p>Onboard partner organisations and their users, and manage the platform-wide insurance plans and partner ecosystem.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'organisations' ? 'active' : ''}`} onClick={() => setTab('organisations')}>Organisations</button>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
        <button className={`tab ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>Insurance plans</button>
        <button className={`tab ${tab === 'partners' ? 'active' : ''}`} onClick={() => setTab('partners')}>Partners</button>
      </div>

      {tab === 'organisations' && <OrgsAdmin />}
      {tab === 'users' && <UsersAdmin />}
      {tab === 'plans' && <PlansAdmin />}
      {tab === 'partners' && <PartnersAdmin />}
    </div>
  );
}

/* ---------------- Plans ---------------- */

const emptyPlan = {
  name: '', plan_type: 'individual', underwriter: '', monthly_premium: '',
  cover_amount: '', currency: 'NGN', commission_rate: '15', description: '', benefits: '',
};

function PlansAdmin() {
  const qc = useQueryClient();
  const { data: plans } = useQuery({ queryKey: ['admin-plans'], queryFn: adminListPlans });
  const [editing, setEditing] = useState<null | (typeof emptyPlan & { id?: string })>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-plans'] });
    qc.invalidateQueries({ queryKey: ['plans'] }); // public catalog
  };

  const openNew = () => { setError(''); setEditing({ ...emptyPlan }); };
  const openEdit = (p: InsurancePlan) => {
    setError('');
    setEditing({
      id: p.id, name: p.name, plan_type: p.plan_type, underwriter: p.underwriter,
      monthly_premium: String(p.monthly_premium), cover_amount: String(p.cover_amount),
      currency: p.currency, commission_rate: String(p.commission_rate),
      description: p.description, benefits: (p.benefits || []).join('\n'),
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    const payload = {
      name: editing.name, plan_type: editing.plan_type, underwriter: editing.underwriter,
      monthly_premium: Number(editing.monthly_premium), cover_amount: Number(editing.cover_amount || 0),
      currency: editing.currency, commission_rate: Number(editing.commission_rate || 0),
      description: editing.description, benefits: editing.benefits,
    };
    try {
      if (editing.id) await adminUpdatePlan(editing.id, payload);
      else await adminCreatePlan(payload);
      setEditing(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not save the plan.'));
    } finally { setBusy(false); }
  };

  const toggleActive = async (p: InsurancePlan) => {
    await adminUpdatePlan(p.id, { is_active: !p.is_active });
    refresh();
  };

  const remove = async (p: InsurancePlan) => {
    if (!confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await adminDeletePlan(p.id);
      refresh();
    } catch (err) {
      alert(errMessage(err, 'Could not delete the plan.'));
    }
  };

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{plans?.length ?? 0} plans</span>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ New plan</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>Underwriter</th><th>Premium</th><th>Commission</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {plans?.map((p) => (
            <tr key={p.id} className={p.is_active ? '' : 'row-inactive'}>
              <td><strong>{p.name}</strong></td>
              <td className="muted small">{p.plan_type}</td>
              <td className="muted small">{p.underwriter}</td>
              <td>{naira(p.monthly_premium, p.currency)}/mo</td>
              <td className="muted small">{p.commission_rate}%</td>
              <td><span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>{p.is_active ? 'active' : 'inactive'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!plans || plans.length === 0) && <p className="empty-state">No plans yet. Add one to get started.</p>}

      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit plan' : 'New plan'}</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Plan type</label>
                <select value={editing.plan_type} onChange={(e) => setEditing({ ...editing, plan_type: e.target.value })}>
                  {PLAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Underwriter</label>
                <input value={editing.underwriter} onChange={(e) => setEditing({ ...editing, underwriter: e.target.value })} placeholder="e.g. AXA Mansard" />
              </div>
              <div className="form-group">
                <label>Currency</label>
                <input value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Monthly premium</label>
                <input type="number" value={editing.monthly_premium} onChange={(e) => setEditing({ ...editing, monthly_premium: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Cover amount</label>
                <input type="number" value={editing.cover_amount} onChange={(e) => setEditing({ ...editing, cover_amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Commission rate (%)</label>
                <input type="number" value={editing.commission_rate} onChange={(e) => setEditing({ ...editing, commission_rate: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label>Description</label>
                <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label>Benefits (one per line)</label>
                <textarea rows={4} value={editing.benefits} onChange={(e) => setEditing({ ...editing, benefits: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !editing.name || !editing.underwriter || !editing.monthly_premium}>
                {busy ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Partners ---------------- */

const emptyPartner = {
  name: '', category: 'insurer', description: '', coverage: '', licence: '', status: 'active',
};

function PartnersAdmin() {
  const qc = useQueryClient();
  const { data: partners } = useQuery({ queryKey: ['admin-partners'], queryFn: adminListPartners });
  const [editing, setEditing] = useState<null | (typeof emptyPartner & { id?: string })>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-partners'] });
    qc.invalidateQueries({ queryKey: ['partners'] }); // public ecosystem page
  };

  const openNew = () => { setError(''); setEditing({ ...emptyPartner }); };
  const openEdit = (p: Partner) => {
    setError('');
    setEditing({
      id: p.id, name: p.name, category: p.category, description: p.description,
      coverage: p.coverage, licence: p.licence, status: p.status,
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    const { id, ...payload } = editing;
    try {
      if (id) await adminUpdatePartner(id, payload);
      else await adminCreatePartner(payload);
      setEditing(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not save the partner.'));
    } finally { setBusy(false); }
  };

  const toggleStatus = async (p: Partner) => {
    await adminUpdatePartner(p.id, { status: p.status === 'active' ? 'inactive' : 'active' });
    refresh();
  };

  const remove = async (p: Partner) => {
    if (!confirm(`Permanently delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await adminDeletePartner(p.id);
      refresh();
    } catch (err) {
      alert(errMessage(err, 'Could not delete the partner.'));
    }
  };

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{partners?.length ?? 0} partners</span>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ New partner</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Name</th><th>Category</th><th>Coverage</th><th>Licence</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {partners?.map((p) => (
            <tr key={p.id} className={p.status === 'active' ? '' : 'row-inactive'}>
              <td><strong>{p.name}</strong></td>
              <td className="muted small">{p.category}</td>
              <td className="muted small">{p.coverage}</td>
              <td className="muted small">{p.licence}</td>
              <td><span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{p.status}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(p)}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!partners || partners.length === 0) && <p className="empty-state">No partners yet. Add one to get started.</p>}

      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit partner' : 'New partner'}</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Name</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {PARTNER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Coverage</label>
                <input value={editing.coverage} onChange={(e) => setEditing({ ...editing, coverage: e.target.value })} placeholder="e.g. National" />
              </div>
              <div className="form-group">
                <label>Licence</label>
                <input value={editing.licence} onChange={(e) => setEditing({ ...editing, licence: e.target.value })} placeholder="e.g. NAICOM / NHIA" />
              </div>
              <div className="form-group form-span-2">
                <label>Description</label>
                <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !editing.name}>
                {busy ? 'Saving…' : 'Save partner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
