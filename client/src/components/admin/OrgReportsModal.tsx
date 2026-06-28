import { useEffect, useState } from 'react';
import axios from 'axios';
import type { Organisation } from '../../types';
import {
  adminGetOrgReports, adminSaveOrgReports, adminPreviewOrgReport, adminSendOrgReportNow,
  type ReportCadence, type ReportRun,
} from '../../api/admin';
import './OrgOnboarding.css';

const CADENCES: { key: ReportCadence; title: string; blurb: string }[] = [
  { key: 'daily', title: 'Daily operations snapshot', blurb: 'Yesterday’s activity — new members, consultations, triage, enrolments, prescriptions & claims. Emailed each morning.' },
  { key: 'weekly', title: 'Weekly engagement summary', blurb: 'Last week’s trends with utilisation and top plans. Week-over-week deltas. Emailed Monday.' },
  { key: 'monthly', title: 'Monthly executive report', blurb: 'The board-level report — premium, claims, indicative loss ratio and telemedicine value delivered. Emailed on the 1st.' },
];

type Editable = { cadence: ReportCadence; recipients: string; isActive: boolean };

function errMsg(err: unknown, fallback: string): string {
  return axios.isAxiosError(err) ? (err.response?.data?.error || fallback) : fallback;
}

export default function OrgReportsModal({ org, onClose }: { org: Organisation; onClose: () => void }) {
  const [tab, setTab] = useState<'config' | 'history'>('config');
  const [rows, setRows] = useState<Editable[]>([]);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [sendMsg, setSendMsg] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ cadence: ReportCadence; html: string; label: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState<ReportCadence | null>(null);

  const load = () => {
    setLoading(true);
    adminGetOrgReports(org.id)
      .then((cfg) => {
        setRows(cfg.subscriptions.map((s) => ({ cadence: s.cadence, recipients: s.recipients.join(', '), isActive: s.isActive })));
        setRuns(cfg.runs);
        setEmailConfigured(cfg.emailConfigured);
      })
      .catch(() => setError('Could not load report settings.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [org.id]);

  const setRow = (cadence: ReportCadence, patch: Partial<Editable>) => {
    setRows((rs) => rs.map((r) => (r.cadence === cadence ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true); setError('');
    try {
      const cfg = await adminSaveOrgReports(org.id, rows.map((r) => ({
        cadence: r.cadence,
        recipients: r.recipients.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean),
        isActive: r.isActive,
      })));
      setRows(cfg.subscriptions.map((s) => ({ cadence: s.cadence, recipients: s.recipients.join(', '), isActive: s.isActive })));
      setRuns(cfg.runs);
      setSaved(true);
    } catch (e) { setError(errMsg(e, 'Could not save report settings.')); }
    finally { setBusy(false); }
  };

  const doPreview = async (cadence: ReportCadence) => {
    setPreviewBusy(cadence); setError('');
    try {
      const r = await adminPreviewOrgReport(org.id, cadence);
      setPreview({ cadence, html: r.html, label: r.periodLabel });
    } catch (e) { setError(errMsg(e, 'Could not generate preview.')); }
    finally { setPreviewBusy(null); }
  };

  const sendNow = async (cadence: ReportCadence) => {
    const row = rows.find((r) => r.cadence === cadence);
    const recips = (row?.recipients || '').split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);
    if (recips.length === 0) { setSendMsg((m) => ({ ...m, [cadence]: 'Add at least one recipient first.' })); return; }
    if (!confirm(`Send the ${cadence} report now to ${recips.length} recipient(s)?`)) return;
    setSendMsg((m) => ({ ...m, [cadence]: 'Sending…' }));
    try {
      const res = await adminSendOrgReportNow(org.id, cadence, recips);
      const note = res.emailConfigured
        ? `Sent to ${res.sent}/${res.recipients.length} for ${res.periodLabel}.`
        : `Generated for ${res.periodLabel} — email not configured, so nothing was delivered (logged only).`;
      setSendMsg((m) => ({ ...m, [cadence]: note }));
      load();
    } catch (e) { setSendMsg((m) => ({ ...m, [cadence]: errMsg(e, 'Send failed.') })); }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide ob-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ob-head">
          <div><h3>Scheduled reports — {org.name}</h3></div>
          <button className="ob-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="od-tabs">
          <button className={tab === 'config' ? 'on' : ''} onClick={() => setTab('config')}>Reports</button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History</button>
        </div>
        <div className="ob-body">
          {loading ? <p className="muted">Loading…</p> : error && rows.length === 0 ? (
            <div className="notice notice-error">{error}</div>
          ) : tab === 'config' ? (
            <>
              <p className="muted small ob-intro">
                Automatically email branded reports to this client on a schedule — the SaaS touch that keeps them engaged without logging in.
                Tick a cadence, add recipient emails, and Save. You can preview or send one immediately.
                Each report opens with an <strong>✨ AI insights</strong> box — a short, factual takeaway written from that period’s figures.
              </p>
              {!emailConfigured && (
                <div className="notice notice-error" style={{ marginBottom: 10 }}>
                  Email delivery isn’t configured on this server (RESEND_API_KEY). Reports will generate and archive, but won’t be delivered until email is switched on.
                </div>
              )}
              {error && <div className="notice notice-error">{error}</div>}
              {CADENCES.map(({ key, title, blurb }) => {
                const row = rows.find((r) => r.cadence === key)!;
                return (
                  <div key={key} className="rep-card">
                    <label className="checkbox-row" style={{ marginBottom: 6 }}>
                      <input type="checkbox" checked={row?.isActive || false} onChange={(e) => setRow(key, { isActive: e.target.checked })} />
                      <span><strong>{title}</strong><div className="muted small">{blurb}</div></span>
                    </label>
                    <label className="muted small" style={{ display: 'block', marginBottom: 4 }}>Recipients (comma-separated emails)</label>
                    <textarea
                      rows={2} value={row?.recipients || ''}
                      onChange={(e) => setRow(key, { recipients: e.target.value })}
                      placeholder="cto@axamansard.com, hr@client.com"
                      style={{ width: '100%', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                    <div className="rep-actions">
                      <button className="btn btn-secondary btn-sm" disabled={previewBusy === key} onClick={() => doPreview(key)}>
                        {previewBusy === key ? 'Building…' : 'Preview'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => sendNow(key)}>Send now</button>
                      {sendMsg[key] && <span className="muted small">{sendMsg[key]}</span>}
                    </div>
                  </div>
                );
              })}
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={onClose}>Close</button>
                <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save report settings'}</button>
              </div>
            </>
          ) : (
            <HistoryTab runs={runs} />
          )}
        </div>
      </div>

      {preview && (
        <div className="drawer-overlay" style={{ zIndex: 60 }} onClick={(e) => { e.stopPropagation(); setPreview(null); }}>
          <div className="modal modal-wide ob-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ob-head">
              <div><h3>Preview · {preview.cadence} · {preview.label}</h3></div>
              <button className="ob-x" onClick={() => setPreview(null)} aria-label="Close">×</button>
            </div>
            <div className="ob-body">
              <iframe title="Report preview" srcDoc={preview.html} style={{ width: '100%', height: 520, border: '1px solid #e3eded', borderRadius: 8, background: '#fff' }} />
              <p className="muted small" style={{ marginTop: 8 }}>This is the email clients receive. Tip: open the live report and use your browser’s Print → Save as PDF to file it.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ runs }: { runs: ReportRun[] }) {
  if (runs.length === 0) return <p className="muted small">No reports generated yet. Use “Send now”, or wait for the scheduled run.</p>;
  return (
    <table width="100%" cellPadding={6} cellSpacing={0} style={{ fontSize: '.85rem', borderCollapse: 'collapse' }}>
      <thead>
        <tr className="muted">
          <td style={{ borderBottom: '2px solid #e3eded' }}>Cadence</td>
          <td style={{ borderBottom: '2px solid #e3eded' }}>Period</td>
          <td style={{ borderBottom: '2px solid #e3eded' }}>Recipients</td>
          <td style={{ borderBottom: '2px solid #e3eded' }}>Status</td>
          <td style={{ borderBottom: '2px solid #e3eded' }}>Generated</td>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td style={{ borderBottom: '1px solid #eef3f3', textTransform: 'capitalize' }}>{r.cadence}</td>
            <td style={{ borderBottom: '1px solid #eef3f3' }}>{r.period_key}</td>
            <td style={{ borderBottom: '1px solid #eef3f3' }}>{r.sent_count}/{r.recipients.length}</td>
            <td style={{ borderBottom: '1px solid #eef3f3' }}>
              <span className={`badge ${r.status === 'sent' ? 'badge-green' : r.status === 'failed' ? 'badge-gray' : 'badge-gray'}`}>{r.status}</span>
            </td>
            <td style={{ borderBottom: '1px solid #eef3f3' }} className="muted">{r.created_at.slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
