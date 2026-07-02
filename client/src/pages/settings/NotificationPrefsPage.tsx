import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  getNotificationPrefs, updateNotificationPrefs, type CategoryMeta,
  getSlackConfig, updateSlackConfig, testSlack,
} from '../../api/notifications';
import { useAuth } from '../../context/AuthContext';

// Per-user notification preferences — which categories show in-app and which are
// also emailed. Email reuses Resend; in-app is the bell/feed.
export default function NotificationPrefsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, isLoading } = useQuery({ queryKey: ['notif-prefs'], queryFn: getNotificationPrefs });
  const [inApp, setInApp] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState<Set<string>>(new Set());
  const [cats, setCats] = useState<CategoryMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCats(data.categories);
    setInApp(new Set(data.categories.filter((c) => !data.muted.includes(c.key)).map((c) => c.key)));
    setEmail(new Set(data.email));
  }, [data]);

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      // muted = categories NOT shown in-app; email = categories the user wants emailed.
      const muted = cats.filter((c) => !inApp.has(c.key)).map((c) => c.key);
      await updateNotificationPrefs(muted, [...email]);
      setSaved(true);
    } finally { setBusy(false); }
  };

  if (isLoading || !data) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Notification settings</h1>
          <p>Choose what appears in your <Link to="/notifications">notifications</Link> and what we email you. These settings are personal to you.</p>
        </div>
      </div>

      <div className="card card-pad">
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th style={{ textAlign: 'center', width: 110 }}>Show in app</th>
              <th style={{ textAlign: 'center', width: 110 }}>Email me</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.key}>
                <td>
                  <strong className="small">{c.label}</strong>
                  <div className="muted small">{c.description}</div>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={inApp.has(c.key)} onChange={() => toggle(inApp, c.key, setInApp)} />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={email.has(c.key)} onChange={() => toggle(email, c.key, setEmail)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save preferences'}
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          Turning off “Show in app” hides that category from your bell and feed. Email also requires that category to be shown in app.
        </p>
      </div>

      {isAdmin && <SlackCard />}
    </div>
  );
}

// Per-org Slack connection (admin-only). PHI-safe: only the notification headline
// + a deep link is ever posted to Slack.
function SlackCard() {
  const { data, refetch } = useQuery({ queryKey: ['slack-config'], queryFn: getSlackConfig });
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!data) return;
    setEnabled(new Set(data.enabled));
    setActive(data.active);
  }, [data]);

  if (!data) return null;
  const errText = (e: unknown, f: string) => (axios.isAxiosError(e) ? e.response?.data?.error || f : f);
  const toggleCat = (key: string) => {
    const n = new Set(enabled); n.has(key) ? n.delete(key) : n.add(key); setEnabled(n); setMsg('');
  };

  const save = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const payload: { active: boolean; categories: string[]; webhookUrl?: string } = { active, categories: [...enabled] };
      if (url.trim()) payload.webhookUrl = url.trim();
      await updateSlackConfig(payload);
      setUrl(''); setMsg('Saved ✓'); refetch();
    } catch (e) { setErr(errText(e, 'Could not save.')); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setErr(''); setMsg('');
    try { await testSlack(); setMsg('Test message sent to Slack ✓'); }
    catch (e) { setErr(errText(e, 'Test failed.')); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    if (!confirm('Disconnect Slack? Notifications will stop posting to the channel.')) return;
    setBusy(true); setErr(''); setMsg('');
    try { await updateSlackConfig({ webhookUrl: '', active, categories: [...enabled] }); setMsg('Disconnected.'); refetch(); }
    catch (e) { setErr(errText(e, 'Could not disconnect.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="card card-pad" style={{ marginTop: 20 }}>
      <h2 style={{ marginTop: 0 }}>Slack</h2>
      <p className="muted small">
        Post a headline + link to your team’s Slack channel for the categories below.{' '}
        <strong>No member data is sent</strong> — only the notification title and a link back into MobiCova.
      </p>
      {data.connected
        ? <p className="small">Connected · <code>{data.urlHint}</code> {data.active
            ? <span className="badge badge-green">active</span>
            : <span className="badge badge-gray">paused</span>}</p>
        : <p className="small muted">Not connected.</p>}

      <div className="form-group">
        <label>{data.connected ? 'Replace webhook URL (optional)' : 'Slack Incoming Webhook URL'}</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.slack.com/services/…" />
        <span className="muted small">In Slack: Apps → Incoming Webhooks → “Add to Workspace” → pick a channel → copy the URL.</span>
      </div>

      <label className="small" style={{ display: 'block', margin: '8px 0' }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{' '}
        Send notifications to Slack (master switch)
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '8px 0' }}>
        {data.categories.map((c) => (
          <label key={c.key} className="small" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={enabled.has(c.key)} onChange={() => toggleCat(c.key)} /> {c.label}
          </label>
        ))}
      </div>

      {err && <div className="notice notice-error">{err}</div>}
      {msg && <div className="muted small">{msg}</div>}
      <div className="form-actions" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={save} disabled={busy || (!data.connected && !url.trim())}>
          {busy ? 'Saving…' : 'Save Slack settings'}
        </button>
        <button className="btn btn-secondary" onClick={test} disabled={busy || !data.connected}>Send test</button>
        {data.connected && <button className="btn btn-secondary" onClick={disconnect} disabled={busy}>Disconnect</button>}
      </div>
    </div>
  );
}
