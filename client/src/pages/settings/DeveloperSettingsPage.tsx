import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  listApiKeys, createApiKey, revokeApiKey,
  listWebhooks, createWebhook, deleteWebhook, updateWebhook, testWebhook,
  listWebhookEvents,
} from '../../api/developer';
import type { NewApiKey, NewWebhookEndpoint, WebhookEndpoint } from '../../types';
import { formatDateTime } from '../../lib/format';
import './Developer.css';

// Public API base = the internal base with /api/v1 swapped for /api/public/v1.
const PUBLIC_API_BASE =
  (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace('/api/v1', '/api/public/v1');

export default function DeveloperSettingsPage() {
  const { user } = useAuth();
  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>API &amp; webhooks</h1>
          <p>Integrate MobiCova with your core policy and claims systems.</p>
        </div>
      </div>

      <div className="card card-pad dev-intro">
        <h2>Public REST API</h2>
        <p className="muted">
          Authenticate with an API key in the <code>Authorization</code> header. All endpoints are
          read-only and scoped to your organisation.
        </p>
        <div className="dev-code">
          <code>
            curl {PUBLIC_API_BASE}/members \<br />
            &nbsp;&nbsp;-H &quot;Authorization: Bearer mk_live_…&quot;
          </code>
        </div>
        <p className="muted small">
          Endpoints: <code>/members</code>, <code>/members/:id</code>, <code>/enrolments</code>,{' '}
          <code>/claims</code>, <code>/claims/:id</code> — all support <code>?limit</code> &amp;{' '}
          <code>?offset</code>.
        </p>
      </div>

      <ApiKeysSection />
      <WebhooksSection />
    </div>
  );
}

function ApiKeysSection() {
  const qc = useQueryClient();
  const { data: keys, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys });
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<NewApiKey | null>(null);
  const [error, setError] = useState('');

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const k = await createApiKey(name.trim() || 'Default key');
      setFresh(k);
      setName('');
      qc.invalidateQueries({ queryKey: ['api-keys'] });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create key.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    await revokeApiKey(id);
    qc.invalidateQueries({ queryKey: ['api-keys'] });
  };

  return (
    <div className="card card-pad">
      <div className="dev-section-head">
        <h2>API keys</h2>
      </div>

      {fresh && (
        <div className="dev-reveal">
          <strong>Copy your key now — it won’t be shown again.</strong>
          <div className="dev-reveal-row">
            <code>{fresh.key}</code>
            <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(fresh.key)}>Copy</button>
          </div>
          <button className="btn btn-link" onClick={() => setFresh(null)}>Done</button>
        </div>
      )}

      <div className="dev-create-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Core claims system)" />
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : keys && keys.length > 0 ? (
        <table className="dev-table">
          <thead>
            <tr><th>Name</th><th>Key</th><th>Last used</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className={k.revoked ? 'dev-revoked' : ''}>
                <td>{k.name}</td>
                <td><code>{k.key_prefix}…</code></td>
                <td>{k.last_used_at ? formatDateTime(k.last_used_at) : '—'}</td>
                <td>
                  <span className={`badge ${k.revoked ? 'badge-gray' : 'badge-green'}`}>
                    {k.revoked ? 'Revoked' : 'Active'}
                  </span>
                </td>
                <td>
                  {!k.revoked && <button className="btn btn-link btn-danger" onClick={() => revoke(k.id)}>Revoke</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">No API keys yet. Create one to start integrating.</p>
      )}
    </div>
  );
}

function WebhooksSection() {
  const qc = useQueryClient();
  const { data: hooks, isLoading } = useQuery({ queryKey: ['webhooks'], queryFn: listWebhooks });
  const { data: events } = useQuery({ queryKey: ['webhook-events'], queryFn: listWebhookEvents });

  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<NewWebhookEndpoint | null>(null);
  const [error, setError] = useState('');
  const [testMsg, setTestMsg] = useState<Record<string, string>>({});

  const toggleEvent = (e: string) =>
    setSelected((s) => (s.includes(e) ? s.filter((x) => x !== e) : [...s, e]));

  const create = async () => {
    if (!url.trim()) { setError('Enter the endpoint URL.'); return; }
    setCreating(true);
    setError('');
    try {
      const w = await createWebhook({ url: url.trim(), events: selected });
      setFresh(w);
      setUrl('');
      setSelected([]);
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create webhook.');
    } finally {
      setCreating(false);
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['webhooks'] });

  const remove = async (id: string) => { await deleteWebhook(id); refresh(); };
  const toggleActive = async (w: WebhookEndpoint) => { await updateWebhook(w.id, { active: !w.active }); refresh(); };
  const test = async (id: string) => {
    setTestMsg((m) => ({ ...m, [id]: 'Sending…' }));
    const r = await testWebhook(id);
    setTestMsg((m) => ({ ...m, [id]: r.delivered ? 'Ping delivered ✓' : 'Ping failed — check the URL' }));
    refresh();
  };

  return (
    <div className="card card-pad">
      <div className="dev-section-head">
        <h2>Webhooks</h2>
      </div>
      <p className="muted">
        We POST a signed JSON event to your URL when things happen. Verify the{' '}
        <code>X-MobiCova-Signature</code> header (HMAC-SHA256 of <code>{'{timestamp}.{body}'}</code>) with your
        endpoint secret.
      </p>

      {fresh && (
        <div className="dev-reveal">
          <strong>Endpoint created. Save your signing secret — it won’t be shown again.</strong>
          <div className="dev-reveal-row">
            <code>{fresh.secret}</code>
            <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(fresh.secret)}>Copy</button>
          </div>
          <button className="btn btn-link" onClick={() => setFresh(null)}>Done</button>
        </div>
      )}

      <div className="dev-webhook-form">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-system.example.com/mobicova-webhook" />
        <div className="dev-events">
          {(events || []).map((e) => (
            <label key={e} className="dev-event">
              <input type="checkbox" checked={selected.includes(e)} onChange={() => toggleEvent(e)} />
              <code>{e}</code>
            </label>
          ))}
        </div>
        <p className="muted small">Leave all unchecked to receive every event.</p>
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? 'Adding…' : 'Add endpoint'}
        </button>
        {error && <div className="error-text">{error}</div>}
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : hooks && hooks.length > 0 ? (
        <div className="dev-hooks">
          {hooks.map((w) => (
            <div key={w.id} className="dev-hook">
              <div className="dev-hook-main">
                <code className="dev-hook-url">{w.url}</code>
                <div className="dev-hook-events">
                  {w.events.length ? w.events.map((e) => <span key={e} className="badge badge-blue">{e}</span>) : <span className="muted small">all events</span>}
                </div>
                {w.last_delivery && (
                  <div className="muted small">
                    Last: {w.last_delivery.event} · {w.last_delivery.success ? 'OK' : 'failed'}
                    {w.last_delivery.status_code ? ` (${w.last_delivery.status_code})` : ''} · {formatDateTime(w.last_delivery.created_at)}
                  </div>
                )}
                {testMsg[w.id] && <div className="muted small">{testMsg[w.id]}</div>}
              </div>
              <div className="dev-hook-actions">
                <span className={`badge ${w.active ? 'badge-green' : 'badge-gray'}`}>{w.active ? 'Active' : 'Paused'}</span>
                <button className="btn btn-link" onClick={() => test(w.id)}>Test</button>
                <button className="btn btn-link" onClick={() => toggleActive(w)}>{w.active ? 'Pause' : 'Resume'}</button>
                <button className="btn btn-link btn-danger" onClick={() => remove(w.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No webhook endpoints yet.</p>
      )}
    </div>
  );
}
