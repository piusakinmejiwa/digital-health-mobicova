import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  adminListHealthSubscribers, adminDeleteHealthSubscriber,
  adminListHealthTips, adminCreateHealthTip, adminUpdateHealthTip, adminDeleteHealthTip,
  adminListHealthTipSends, adminSendHealthTipNow,
  type HealthTip, type HealthTipSendSummary,
} from '../../api/healthTips';
import { csvCell } from '../../lib/download';

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

export default function HealthTipsAdmin() {
  const [section, setSection] = useState<'subscribers' | 'tips' | 'sends'>('subscribers');
  return (
    <div className="card">
      <div className="prov-tabs" style={{ marginBottom: 16 }}>
        <button className={`prov-tab ${section === 'subscribers' ? 'active' : ''}`} onClick={() => setSection('subscribers')}>Subscribers</button>
        <button className={`prov-tab ${section === 'tips' ? 'active' : ''}`} onClick={() => setSection('tips')}>Tip library</button>
        <button className={`prov-tab ${section === 'sends' ? 'active' : ''}`} onClick={() => setSection('sends')}>Send & history</button>
      </div>
      {section === 'subscribers' && <Subscribers />}
      {section === 'tips' && <Tips />}
      {section === 'sends' && <Sends />}
    </div>
  );
}

function Subscribers() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ht-subscribers'], queryFn: adminListHealthSubscribers });
  const subs = data?.subscribers ?? [];

  const exportCsv = () => {
    const head = ['Name', 'SMS', 'WhatsApp', 'Email', 'Channels', 'Active', 'Joined'];
    const rows = subs.map((s) => [s.full_name, s.sms_number, s.whatsapp_number, s.email, (s.channels || []).join('|'), s.is_active ? 'yes' : 'no', new Date(s.created_at).toISOString()]);
    const csv = [head, ...rows].map((r) => r.map((c) => csvCell(c)).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'health-tip-subscribers.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this subscriber? This cannot be undone.')) return;
    try { await adminDeleteHealthSubscriber(id); qc.invalidateQueries({ queryKey: ['ht-subscribers'] }); }
    catch (err) { alert(errMessage(err, 'Could not delete.')); }
  };

  return (
    <>
      <div className="admin-toolbar">
        <span className="muted small">{subs.length} subscribers</span>
        <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={subs.length === 0}>Export CSV</button>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>SMS</th><th>WhatsApp</th><th>Email</th><th>Channels</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {subs.map((s) => (
            <tr key={s.id} className={s.is_active ? '' : 'row-inactive'}>
              <td><strong>{s.full_name}</strong></td>
              <td className="muted small">{s.sms_number || '—'}</td>
              <td className="muted small">{s.whatsapp_number || '—'}</td>
              <td className="muted small">{s.email || '—'}</td>
              <td className="muted small">{(s.channels || []).join(', ') || '—'}</td>
              <td><span className={`badge ${s.is_active ? 'badge-green' : 'badge-gray'}`}>{s.is_active ? 'active' : 'unsubscribed'}</span></td>
              <td className="admin-actions"><button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {subs.length === 0 && <p className="empty-state">No subscribers yet.</p>}
    </>
  );
}

const emptyTip = { title: '', body: '', category: 'general' };

function Tips() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ht-tips'], queryFn: adminListHealthTips });
  const tips = data?.tips ?? [];
  const [editing, setEditing] = useState<null | (typeof emptyTip & { id?: string })>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['ht-tips'] });

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      if (editing.id) await adminUpdateHealthTip(editing.id, { title: editing.title, body: editing.body, category: editing.category });
      else await adminCreateHealthTip({ title: editing.title.trim(), body: editing.body.trim(), category: editing.category.trim() });
      setEditing(null); refresh();
    } catch (err) { setError(errMessage(err, 'Could not save the tip.')); }
    finally { setBusy(false); }
  };
  const toggle = async (t: HealthTip) => {
    try { await adminUpdateHealthTip(t.id, { is_active: !t.is_active }); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not update.')); }
  };
  const remove = async (t: HealthTip) => {
    if (!confirm(`Delete the tip "${t.title}"?`)) return;
    try { await adminDeleteHealthTip(t.id); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not delete.')); }
  };

  return (
    <>
      <div className="admin-toolbar">
        <span className="muted small">{tips.length} tips · one is sent per day, rotating by order</span>
        <button className="btn btn-primary btn-sm" onClick={() => { setError(''); setEditing({ ...emptyTip }); }}>+ Add a tip</button>
      </div>
      <table className="table">
        <thead><tr><th>#</th><th>Title</th><th>Tip</th><th>Category</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {tips.map((t) => (
            <tr key={t.id} className={t.is_active ? '' : 'row-inactive'}>
              <td className="muted small">{t.seq}</td>
              <td><strong>{t.title}</strong></td>
              <td className="muted small">{t.body.length > 90 ? t.body.slice(0, 90) + '…' : t.body}</td>
              <td className="muted small">{t.category}</td>
              <td><span className={`badge ${t.is_active ? 'badge-green' : 'badge-gray'}`}>{t.is_active ? 'active' : 'off'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditing({ id: t.id, title: t.title, body: t.body, category: t.category }); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggle(t)}>{t.is_active ? 'Disable' : 'Enable'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(t)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tips.length === 0 && <p className="empty-state">No tips yet. Add one to start the rotation.</p>}

      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit tip' : 'Add a tip'}</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-group">
              <label>Title</label>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Stay hydrated" />
            </div>
            <div className="form-group">
              <label>Tip (keep it short — also goes out by SMS)</label>
              <textarea rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder="One practical sentence or two." />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="general" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !editing.title.trim() || !editing.body.trim()}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Sends() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ht-sends'], queryFn: adminListHealthTipSends });
  const sends = data?.sends ?? [];
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<HealthTipSendSummary | null>(null);

  const sendNow = async () => {
    if (!confirm('Send today’s tip now to all active subscribers? (Safe to run more than once — it won’t double-send today.)')) return;
    setBusy(true);
    try {
      const s = await adminSendHealthTipNow();
      setSummary(s);
      qc.invalidateQueries({ queryKey: ['ht-sends'] });
    } catch (err) { alert(errMessage(err, 'Could not send.')); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="admin-toolbar">
        <span className="muted small">Manual send (your daily scheduler can also call the run-daily endpoint)</span>
        <button className="btn btn-primary btn-sm" onClick={sendNow} disabled={busy}>{busy ? 'Sending…' : '📤 Send today’s tip now'}</button>
      </div>

      {summary && (
        <div className="notice" style={{ marginBottom: 14 }}>
          {summary.tip ? <><strong>Sent “{summary.tip.title}”</strong> to {summary.subscribers} subscribers — </> : <>No active tips to send. </>}
          {summary.tip && (
            <>email {summary.sent.email}✓/{summary.failed.email}✗ · sms {summary.sent.sms}✓/{summary.failed.sms}✗ · whatsapp {summary.sent.whatsapp}✓/{summary.failed.whatsapp}✗ · skipped {summary.skipped}.</>
          )}
          <div className="muted small" style={{ marginTop: 4 }}>
            Channels live: email {summary.configured.email ? '✓' : '✗'} · SMS {summary.configured.sms ? '✓' : '✗ (add AT credentials)'} · WhatsApp {summary.configured.whatsapp ? '✓' : '✗ (needs approved template)'}
          </div>
        </div>
      )}

      <table className="table">
        <thead><tr><th>When</th><th>Subscriber</th><th>Tip</th><th>Channel</th><th>Status</th></tr></thead>
        <tbody>
          {sends.map((s) => (
            <tr key={s.id}>
              <td className="muted small">{new Date(s.created_at).toLocaleString()}</td>
              <td>{s.full_name || '—'}</td>
              <td className="muted small">{s.tip_title || '—'}</td>
              <td className="muted small">{s.channel}</td>
              <td>
                <span className={`badge ${s.status === 'sent' ? 'badge-green' : s.status === 'failed' ? 'badge-red' : 'badge-gray'}`}>{s.status}</span>
                {s.error && <span className="muted small" title={s.error}> ⚠</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sends.length === 0 && <p className="empty-state">No sends yet.</p>}
    </>
  );
}
