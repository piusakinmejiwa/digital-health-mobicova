import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Organisation } from '../../types';
import {
  adminListDistributionPartners, adminCreateDistributionPartner,
  adminRotateDistributionKey, adminUpdateDistributionPartner, adminListOrgs,
  type DistributionPartner,
} from '../../api/admin';
import ListControls from '../../components/common/ListControls';

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString() : 'never');

// One-time credentials returned when a partner is created or its key rotated.
interface Creds { title: string; name: string; apiKey: string; webhookSecret?: string }

const emptyForm = { orgId: '', name: '', slug: '', webhookUrl: '', commissionRate: 0, platformFeeRate: 0, sandbox: true };

export default function DistributionAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-distribution'], queryFn: adminListDistributionPartners });
  const { data: orgs } = useQuery({ queryKey: ['admin-orgs'], queryFn: adminListOrgs });
  const partners = data?.partners ?? [];

  const [creating, setCreating] = useState<null | typeof emptyForm>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [editing, setEditing] = useState<null | DistributionPartner>(null);
  const [creds, setCreds] = useState<null | Creds>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-distribution'] });

  const q = search.trim().toLowerCase();
  const filtered = partners.filter((p) => {
    if (modeFilter === 'live' && (p.sandbox || !p.active)) return false;
    if (modeFilter === 'sandbox' && !p.sandbox) return false;
    if (modeFilter === 'inactive' && p.active) return false;
    if (!q) return true;
    return [p.name, p.slug, p.org_name].some((v) => (v || '').toLowerCase().includes(q));
  });

  const openNew = () => { setError(''); setSlugTouched(false); setCreating({ ...emptyForm, orgId: orgs?.[0]?.id ?? '' }); };

  const create = async () => {
    if (!creating) return;
    setBusy(true); setError('');
    try {
      const res = await adminCreateDistributionPartner({
        orgId: creating.orgId, name: creating.name.trim(),
        slug: creating.slug.trim() || slugify(creating.name),
        webhookUrl: creating.webhookUrl.trim() || undefined,
        commissionRate: Number(creating.commissionRate) || 0,
        platformFeeRate: Number(creating.platformFeeRate) || 0,
        sandbox: creating.sandbox,
      });
      setCreating(null);
      setCreds({ title: 'Partner created', name: res.name, apiKey: res.apiKey, webhookSecret: res.webhookSecret });
      refresh();
    } catch (err) { setError(errMessage(err, 'Could not create the partner.')); }
    finally { setBusy(false); }
  };

  const rotate = async (p: DistributionPartner) => {
    if (!confirm(`Rotate the API key for ${p.name}? The current key stops working immediately.`)) return;
    try {
      const res = await adminRotateDistributionKey(p.id);
      setCreds({ title: 'New API key', name: p.name, apiKey: res.apiKey });
      refresh();
    } catch (err) { alert(errMessage(err, 'Could not rotate the key.')); }
  };

  const patch = async (p: DistributionPartner, body: Parameters<typeof adminUpdateDistributionPartner>[1]) => {
    try { await adminUpdateDistributionPartner(p.id, body); refresh(); }
    catch (err) { alert(errMessage(err, 'Could not update the partner.')); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    try {
      await adminUpdateDistributionPartner(editing.id, {
        webhookUrl: editing.webhook_url,
        commissionRate: Number(editing.commission_rate) || 0,
        platformFeeRate: Number(editing.platform_fee_rate) || 0,
      });
      setEditing(null); refresh();
    } catch (err) { setError(errMessage(err, 'Could not update the partner.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{filtered.length} of {partners.length} distribution partners</span>
        <button className="btn btn-primary btn-sm" onClick={openNew} disabled={!orgs || orgs.length === 0}>+ Sign up a partner</button>
      </div>
      <p className="muted small" style={{ marginTop: -4 }}>
        Channels that sell an underwriter&rsquo;s plans via the Partner Distribution API (PalmPay, OPay, telco wallets, aggregators).
      </p>
      <ListControls
        search={search} onSearch={setSearch}
        placeholder="Search name, slug or underwriter…"
        filters={[{
          label: 'Mode', value: modeFilter, onChange: setModeFilter,
          options: [
            { value: '', label: 'All' }, { value: 'live', label: 'Live' },
            { value: 'sandbox', label: 'Sandbox' }, { value: 'inactive', label: 'Inactive' },
          ],
        }]}
      />
      <table className="table">
        <thead>
          <tr><th>Partner</th><th>Underwriter</th><th>Key</th><th>Mode</th><th>Comm / MobiCova fee</th><th>Last used</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id} className={p.active ? '' : 'row-inactive'}>
              <td><strong>{p.name}</strong><br /><span className="muted small">{p.slug}</span></td>
              <td className="muted small">{p.org_name}</td>
              <td className="muted small"><code>{p.key_prefix || '—'}…</code></td>
              <td>
                {!p.active
                  ? <span className="badge badge-gray">inactive</span>
                  : p.sandbox
                    ? <span className="badge badge-amber">sandbox</span>
                    : <span className="badge badge-green">live</span>}
              </td>
              <td className="muted small">{Number(p.commission_rate)}% / {Number(p.platform_fee_rate)}%</td>
              <td className="muted small">{fmtDate(p.last_used_at)}</td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setError(''); setEditing({ ...p }); }}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => patch(p, { sandbox: !p.sandbox })}>
                  {p.sandbox ? 'Go live' : 'To sandbox'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => rotate(p)}>Rotate key</button>
                <button className="btn btn-secondary btn-sm" onClick={() => patch(p, { active: !p.active })}>
                  {p.active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {partners.length > 0 && filtered.length === 0 && <p className="empty-state">No partners match your search.</p>}
      {partners.length === 0 && <p className="empty-state">No distribution partners yet. Sign one up to start selling through their app.</p>}
      {(!orgs || orgs.length === 0) && <p className="empty-state">Add an underwriter organisation first (Organisations tab).</p>}

      {/* ---- Create modal ---- */}
      {creating && (
        <div className="drawer-overlay" onClick={() => setCreating(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>Sign up a distribution partner</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Underwriter (whose plans they sell)</label>
                <select value={creating.orgId} onChange={(e) => setCreating({ ...creating, orgId: e.target.value })}>
                  {(orgs ?? []).map((o: Organisation) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Partner name</label>
                <input value={creating.name} placeholder="e.g. PalmPay"
                  onChange={(e) => setCreating({ ...creating, name: e.target.value, slug: slugTouched ? creating.slug : slugify(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Slug</label>
                <input value={creating.slug} placeholder="e.g. palmpay"
                  onChange={(e) => { setSlugTouched(true); setCreating({ ...creating, slug: slugify(e.target.value) }); }} />
              </div>
              <div className="form-group">
                <label>Partner commission (%)</label>
                <input type="number" min={0} max={100} value={creating.commissionRate}
                  onChange={(e) => setCreating({ ...creating, commissionRate: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>MobiCova platform fee (%)</label>
                <input type="number" min={0} max={100} value={creating.platformFeeRate}
                  onChange={(e) => setCreating({ ...creating, platformFeeRate: Number(e.target.value) })} />
              </div>
              <div className="form-group form-span-2">
                <label>Webhook URL (optional)</label>
                <input value={creating.webhookUrl} placeholder="https://api.palmpay.com/mobicova/webhooks"
                  onChange={(e) => setCreating({ ...creating, webhookUrl: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label className="checkbox-inline">
                  <input type="checkbox" checked={creating.sandbox}
                    onChange={(e) => setCreating({ ...creating, sandbox: e.target.checked })} />
                  {' '}Start in sandbox (test enrolments, no real cover) — recommended until integration is verified
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setCreating(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={busy || !creating.orgId || !creating.name.trim()}>
                {busy ? 'Creating…' : 'Create partner'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit modal ---- */}
      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {editing.name}</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-group">
              <label>Webhook URL</label>
              <input value={editing.webhook_url} onChange={(e) => setEditing({ ...editing, webhook_url: e.target.value })}
                placeholder="https://…" />
            </div>
            <div className="form-group">
              <label>Partner commission (%)</label>
              <input type="number" min={0} max={100} value={editing.commission_rate}
                onChange={(e) => setEditing({ ...editing, commission_rate: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>MobiCova platform fee (%)</label>
              <input type="number" min={0} max={100} value={editing.platform_fee_rate}
                onChange={(e) => setEditing({ ...editing, platform_fee_rate: Number(e.target.value) })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Credentials shown ONCE ---- */}
      {creds && (
        <div className="drawer-overlay" onClick={() => setCreds(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{creds.title} — {creds.name}</h3>
            <div className="notice" style={{ background: '#fff8e6', borderColor: '#f0d48a', color: '#7a5b00' }}>
              Copy these now — they are shown only once and stored only as a hash. Share with the partner over a secure channel.
            </div>
            <SecretRow label="API key" value={creds.apiKey} />
            {creds.webhookSecret && <SecretRow label="Webhook secret" value={creds.webhookSecret} />}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setCreds(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SecretRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return (
    <div className="form-group">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <code style={{ flex: 1, wordBreak: 'break-all', background: '#f4f7f7', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}>{value}</code>
        <button className="btn btn-secondary btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  );
}
