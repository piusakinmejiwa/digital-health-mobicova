import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getNotificationPrefs, updateNotificationPrefs, type CategoryMeta } from '../../api/notifications';

// Per-user notification preferences — which categories show in-app and which are
// also emailed. Email reuses Resend; in-app is the bell/feed.
export default function NotificationPrefsPage() {
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
    </div>
  );
}
