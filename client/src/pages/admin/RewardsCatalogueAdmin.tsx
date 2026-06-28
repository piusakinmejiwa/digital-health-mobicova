import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminListCatalogue, adminCreateCatalogueItem, adminUpdateCatalogueItem, adminDeleteCatalogueItem,
  adminListRedemptions, adminUpdateRedemption,
  type CatalogueItemAdmin,
} from '../../api/admin';

// Rewards Phase 3 admin: the redemption catalogue + the redemptions queue.

const CAT_BLANK = { title: '', description: '', kind: 'voucher', costPoints: 100, valueLabel: '', stock: '', isActive: true };

export function CatalogueAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-catalogue'], queryFn: adminListCatalogue });
  const [form, setForm] = useState<typeof CAT_BLANK | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-catalogue'] });
  const kinds = data?.kinds ?? ['voucher'];

  const openNew = () => { setEditId(null); setForm({ ...CAT_BLANK }); };
  const openEdit = (c: CatalogueItemAdmin) => {
    setEditId(c.id);
    setForm({ title: c.title, description: c.description, kind: c.kind, costPoints: c.cost_points, valueLabel: c.value_label, stock: c.stock == null ? '' : String(c.stock), isActive: c.is_active });
  };
  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      if (editId) await adminUpdateCatalogueItem(editId, form);
      else await adminCreateCatalogueItem(form);
      setForm(null); refresh();
    } finally { setBusy(false); }
  };
  const remove = async (c: CatalogueItemAdmin) => {
    if (!confirm(`Delete "${c.title}"?`)) return;
    await adminDeleteCatalogueItem(c.id); refresh();
  };
  const items = data?.items ?? [];

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{items.length} reward{items.length === 1 ? '' : 's'} members can redeem points for</span>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ New reward</button>
      </div>
      <table className="table">
        <thead><tr><th>Reward</th><th>Kind</th><th>Cost</th><th>Stock</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className={c.is_active ? '' : 'row-inactive'}>
              <td><strong>{c.title}</strong>{c.value_label && <span className="muted small"> · {c.value_label}</span>}<div className="muted small">{c.description}</div></td>
              <td className="muted small">{c.kind}</td>
              <td className="muted small">{c.cost_points} pts</td>
              <td className="muted small">{c.stock == null ? '∞' : c.stock}</td>
              <td><span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'active' : 'off'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => remove(c)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="empty-state">No rewards yet. Add airtime, a premium discount or a voucher.</p>}

      {form && (
        <div className="drawer-overlay" onClick={() => setForm(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit reward' : 'New reward'}</h3>
            <div className="form-grid">
              <div className="form-group form-span-2">
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. ₦500 airtime" />
              </div>
              <div className="form-group form-span-2">
                <label>Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Kind</label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                  {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Value label</label>
                <input value={form.valueLabel} onChange={(e) => setForm({ ...form, valueLabel: e.target.value })} placeholder="e.g. ₦500" />
              </div>
              <div className="form-group">
                <label>Cost (points)</label>
                <input type="number" min={1} value={form.costPoints} onChange={(e) => setForm({ ...form, costPoints: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Stock <span className="muted">(blank = unlimited)</span></label>
                <input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="∞" />
              </div>
              <label className="checkbox-row form-span-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>Active</span>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : 'Save reward'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const REDEMPTION_NEXT: Record<string, { label: string; status: string }[]> = {
  requested: [{ label: 'Approve', status: 'approved' }, { label: 'Reject', status: 'rejected' }],
  approved: [{ label: 'Mark fulfilled', status: 'fulfilled' }, { label: 'Reject', status: 'rejected' }],
  fulfilled: [],
  rejected: [],
};

export function RedemptionsAdmin() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const { data } = useQuery({ queryKey: ['admin-redemptions', filter], queryFn: () => adminListRedemptions(filter) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-redemptions'] });
  const act = async (id: string, status: string) => { await adminUpdateRedemption(id, status); refresh(); };
  const rows = data?.redemptions ?? [];

  return (
    <div className="card">
      <div className="admin-toolbar">
        <select className="admin-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {['requested', 'approved', 'fulfilled', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="muted small">{rows.length} redemption{rows.length === 1 ? '' : 's'}</span>
      </div>
      <table className="table">
        <thead><tr><th>Member</th><th>Reward</th><th>Cost</th><th>Requested</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.member_name}<div className="muted small">{r.member_phone}</div></td>
              <td>{r.title}</td>
              <td className="muted small">{r.cost_points} pts</td>
              <td className="muted small">{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
              <td><span className={`badge ${r.status === 'fulfilled' ? 'badge-green' : r.status === 'rejected' ? 'badge-gray' : 'badge-amber'}`}>{r.status}</span></td>
              <td className="admin-actions">
                {(REDEMPTION_NEXT[r.status] || []).map((a) => (
                  <button key={a.status} className="btn btn-secondary btn-sm" onClick={() => act(r.id, a.status)}>{a.label}</button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty-state">No redemptions{filter ? ` with status “${filter}”` : ' yet'}.</p>}
    </div>
  );
}
