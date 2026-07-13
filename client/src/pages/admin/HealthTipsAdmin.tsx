import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  adminListHealthSubscribers, adminDeleteHealthSubscriber,
  adminListHealthTips, adminCreateHealthTip, adminUpdateHealthTip, adminDeleteHealthTip,
  adminListHealthTipSends, adminSendHealthTipNow, adminGenerateHealthTipDraft,
  type HealthTip, type HealthTipFields, type HealthTipSendSummary,
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

type TipForm = HealthTipFields & { id?: string };
const emptyTip: TipForm = {
  title: '', body: '', sms_text: '', why_it_matters: '', action: '',
  myth: '', fact: '', source: '', category: 'general', status: 'published',
};

function Tips() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ht-tips'], queryFn: adminListHealthTips });
  const tips = data?.tips ?? [];
  const [editing, setEditing] = useState<TipForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['ht-tips'] });
  const set = (patch: Partial<TipForm>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    const payload: HealthTipFields = {
      title: editing.title.trim(), body: editing.body.trim(),
      sms_text: editing.sms_text.trim(), why_it_matters: editing.why_it_matters.trim(),
      action: editing.action.trim(), myth: editing.myth.trim(), fact: editing.fact.trim(),
      source: editing.source.trim(), category: editing.category.trim() || 'general', status: editing.status,
    };
    try {
      if (editing.id) await adminUpdateHealthTip(editing.id, payload);
      else await adminCreateHealthTip(payload);
      setEditing(null); refresh();
    } catch (err) { setError(errMessage(err, 'Could not save the tip.')); }
    finally { setBusy(false); }
  };
  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const { draft } = await adminGenerateHealthTipDraft(topic);
      // Land AI output as a DRAFT the admin must review + publish.
      setEditing((e) => ({ ...(e || emptyTip), ...draft, status: 'draft' }));
    } catch (err) { setError(errMessage(err, 'Could not generate a draft (is AI enabled?).')); }
    finally { setGenerating(false); }
  };
  const toggle = async (t: HealthTip) => {
    try { await adminUpdateHealthTip(t.id, { is_active: !t.is_active }); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not update.')); }
  };
  // Approve a draft in one click: mark it published + enabled so it joins the rotation.
  const publish = async (t: HealthTip) => {
    try { await adminUpdateHealthTip(t.id, { status: 'published', is_active: true }); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not publish.')); }
  };
  const remove = async (t: HealthTip) => {
    if (!confirm(`Delete the tip "${t.title}"?`)) return;
    try { await adminDeleteHealthTip(t.id); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not delete.')); }
  };
  const openNew = () => { setError(''); setTopic(''); setEditing({ ...emptyTip }); };
  const openEdit = (t: HealthTip) => {
    setError(''); setTopic('');
    setEditing({
      id: t.id, title: t.title, body: t.body, sms_text: t.sms_text, why_it_matters: t.why_it_matters,
      action: t.action, myth: t.myth, fact: t.fact, source: t.source, category: t.category, status: t.status,
    });
  };

  return (
    <>
      <div className="admin-toolbar">
        <span className="muted small">{tips.length} tips · one published tip is sent per day, rotating by order</span>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ Add a tip</button>
      </div>
      <table className="table">
        <thead><tr><th>#</th><th>Title</th><th>Tip</th><th>Category</th><th>State</th><th></th></tr></thead>
        <tbody>
          {tips.map((t) => (
            <tr key={t.id} className={t.is_active && t.status === 'published' ? '' : 'row-inactive'}>
              <td className="muted small">{t.seq}</td>
              <td><strong>{t.title}</strong></td>
              <td className="muted small">{t.body.length > 80 ? t.body.slice(0, 80) + '…' : t.body}</td>
              <td className="muted small">{t.category}</td>
              <td>
                {t.status === 'draft'
                  ? <span className="badge badge-amber">draft</span>
                  : <span className={`badge ${t.is_active ? 'badge-green' : 'badge-gray'}`}>{t.is_active ? 'live' : 'off'}</span>}
              </td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>Edit</button>
                {t.status === 'draft'
                  ? <button className="btn btn-primary btn-sm" onClick={() => publish(t)}>Publish</button>
                  : <button className="btn btn-secondary btn-sm" onClick={() => toggle(t)}>{t.is_active ? 'Disable' : 'Enable'}</button>}
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

            {/* AI draft assist — writes a structured draft the admin then reviews. */}
            <div className="notice" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>✨ Draft with AI</div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                Optionally name a topic, then let Claude draft a structured tip. It lands as a <strong>draft</strong> for you to review and edit — nothing sends until you publish.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic (optional) — e.g. malaria in the rainy season" style={{ flex: 1 }} />
                <button className="btn btn-secondary" onClick={generate} disabled={generating}>{generating ? 'Drafting…' : 'Generate draft'}</button>
              </div>
            </div>

            <div className="form-group">
              <label>Title</label>
              <input value={editing.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Stay hydrated" />
            </div>
            <div className="form-group">
              <label>SMS text <span className="muted small">— lean, one segment (~150 chars). Falls back to the body if empty.</span></label>
              <textarea rows={2} value={editing.sms_text} onChange={(e) => set({ sms_text: e.target.value })} placeholder="The whole tip in one short sentence for SMS." />
              <div className="muted small" style={{ marginTop: 2 }}>{editing.sms_text.length} chars{editing.sms_text.length > 160 ? ' · over one SMS segment' : ''}</div>
            </div>
            <div className="form-group">
              <label>Body <span className="muted small">— main explanation (WhatsApp + email lead)</span></label>
              <textarea rows={3} value={editing.body} onChange={(e) => set({ body: e.target.value })} placeholder="Two to four sentences." />
            </div>
            <div className="form-group">
              <label>Why it matters <span className="muted small">— email only (optional)</span></label>
              <textarea rows={2} value={editing.why_it_matters} onChange={(e) => set({ why_it_matters: e.target.value })} placeholder="Why this matters for the reader." />
            </div>
            <div className="form-group">
              <label>Try this today <span className="muted small">— one action step (WhatsApp + email)</span></label>
              <textarea rows={2} value={editing.action} onChange={(e) => set({ action: e.target.value })} placeholder="One concrete step the reader can take today." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Myth <span className="muted small">— email only (optional)</span></label>
                <textarea rows={2} value={editing.myth} onChange={(e) => set({ myth: e.target.value })} placeholder="A common misconception." />
              </div>
              <div className="form-group">
                <label>Fact <span className="muted small">— the correction</span></label>
                <textarea rows={2} value={editing.fact} onChange={(e) => set({ fact: e.target.value })} placeholder="Setting it straight." />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Category</label>
                <input value={editing.category} onChange={(e) => set({ category: e.target.value })} placeholder="general" />
              </div>
              <div className="form-group">
                <label>Source <span className="muted small">— e.g. WHO, Nigeria CDC (optional)</span></label>
                <input value={editing.source} onChange={(e) => set({ source: e.target.value })} placeholder="WHO" />
              </div>
            </div>
            <div className="form-group">
              <label>State</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                  <input type="radio" checked={editing.status === 'draft'} onChange={() => set({ status: 'draft' })} /> Draft (not sent)
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                  <input type="radio" checked={editing.status === 'published'} onChange={() => set({ status: 'published' })} /> Published (in the daily rotation)
                </label>
              </div>
            </div>

            <TipPreview tip={editing} />

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !editing.title.trim() || !editing.body.trim()}>{busy ? 'Saving…' : editing.status === 'published' ? 'Save & publish' : 'Save draft'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Shows how the tip renders on each channel — the same shaping the send engine uses.
function TipPreview({ tip }: { tip: TipForm }) {
  const t = (s: string) => s.trim();
  const smsLine = t(tip.sms_text) || t(tip.body);
  const waBits = [t(tip.body), t(tip.action) ? `Try this today: ${t(tip.action)}` : ''].filter(Boolean).join(' ');
  const wa = `${t(tip.title)} — ${waBits}`.replace(/\s+/g, ' ').trim();
  return (
    <div style={{ border: '1px solid #e3eded', borderRadius: 10, padding: 14, marginTop: 6, background: '#fbfdfd' }}>
      <div className="muted small" style={{ fontWeight: 700, marginBottom: 8 }}>Channel preview</div>
      <div style={{ marginBottom: 10 }}>
        <div className="muted small" style={{ fontWeight: 600 }}>SMS</div>
        <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>MobiCova Daily Health Tip — {t(tip.title)}{'\n\n'}{smsLine}{'\n'}Reply STOP to opt out.</div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="muted small" style={{ fontWeight: 600 }}>WhatsApp</div>
        <div style={{ fontSize: 13 }}>{wa}</div>
      </div>
      <div>
        <div className="muted small" style={{ fontWeight: 600, marginBottom: 4 }}>Email</div>
        <div style={{ border: '1px solid #e3eded', borderRadius: 8, overflow: 'hidden', maxWidth: 460 }}>
          <div style={{ background: '#0a7b7b', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', padding: '8px 12px' }}>MOBICOVA · DAILY HEALTH TIP</div>
          <div style={{ padding: '12px 14px' }}>
            <div style={{ color: '#0a7b7b', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{t(tip.title) || 'Title'}</div>
            <div style={{ fontSize: 13, marginBottom: t(tip.why_it_matters) || t(tip.action) ? 10 : 0 }}>{t(tip.body)}</div>
            {t(tip.why_it_matters) && <div style={{ marginBottom: 10 }}><div style={{ color: '#0a7b7b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Why it matters</div><div style={{ fontSize: 13 }}>{t(tip.why_it_matters)}</div></div>}
            {t(tip.action) && <div style={{ background: '#f0f9f9', borderLeft: '4px solid #0a7b7b', borderRadius: 6, padding: '8px 10px', marginBottom: 10 }}><div style={{ color: '#0a7b7b', fontWeight: 700, fontSize: 13 }}>✅ Try this today</div><div style={{ fontSize: 13 }}>{t(tip.action)}</div></div>}
            {t(tip.myth) && t(tip.fact) && <div style={{ border: '1px solid #e3eded', borderRadius: 6, padding: '8px 10px' }}><div style={{ fontSize: 12 }}><b style={{ color: '#b4531f' }}>Myth:</b> {t(tip.myth)}</div><div style={{ fontSize: 12 }}><b style={{ color: '#0a7b7b' }}>Fact:</b> {t(tip.fact)}</div></div>}
            {t(tip.source) && <div className="muted small" style={{ marginTop: 8 }}>Source: {t(tip.source)}.</div>}
          </div>
        </div>
      </div>
    </div>
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
