import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Partner, InsurancePlan } from '../../types';
import {
  adminListPartners, adminCreatePartner, adminUpdatePartner, adminDeletePartner,
  adminListPlans, adminCreatePlan, adminUpdatePlan, adminDeletePlan,
  adminAiStatus, adminBuddySafety,
} from '../../api/admin';
import {
  adminListBlog, adminCreateBlog, adminUpdateBlog, adminDeleteBlog, uploadBlogImage, type AdminBlogPost,
} from '../../api/blog';
import { naira } from '../../lib/format';
import OrgsAdmin from './OrgsAdmin';
import UsersAdmin from './UsersAdmin';
import ProvidersAdmin from './ProvidersAdmin';
import AuditAdmin from './AuditAdmin';
import './Admin.css';

const PLAN_TYPES = ['individual', 'family', 'hospital_cash', 'group', 'wellness'];
const PARTNER_CATEGORIES = ['telemedicine', 'insurer', 'pharmacy', 'diagnostics', 'ehr', 'distribution'];

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

type AdminTab = 'organisations' | 'users' | 'providers' | 'plans' | 'partners' | 'blog' | 'audit' | 'safety' | 'system';

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
        <button className={`tab ${tab === 'providers' ? 'active' : ''}`} onClick={() => setTab('providers')}>Providers</button>
        <button className={`tab ${tab === 'plans' ? 'active' : ''}`} onClick={() => setTab('plans')}>Insurance plans</button>
        <button className={`tab ${tab === 'partners' ? 'active' : ''}`} onClick={() => setTab('partners')}>Partners</button>
        <button className={`tab ${tab === 'blog' ? 'active' : ''}`} onClick={() => setTab('blog')}>Blog</button>
        <button className={`tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit log</button>
        <button className={`tab ${tab === 'safety' ? 'active' : ''}`} onClick={() => setTab('safety')}>Buddy Safety</button>
        <button className={`tab ${tab === 'system' ? 'active' : ''}`} onClick={() => setTab('system')}>System</button>
      </div>

      {tab === 'organisations' && <OrgsAdmin />}
      {tab === 'users' && <UsersAdmin />}
      {tab === 'providers' && <ProvidersAdmin />}
      {tab === 'plans' && <PlansAdmin />}
      {tab === 'partners' && <PartnersAdmin />}
      {tab === 'blog' && <BlogAdmin />}
      {tab === 'audit' && <AuditAdmin />}
      {tab === 'safety' && <SafetyAdmin />}
      {tab === 'system' && <SystemAdmin />}
    </div>
  );
}

/* ---------------- Blog ---------------- */

const emptyPost = {
  id: '' as string | undefined, title: '', slug: '', excerpt: '', body: '', coverImageUrl: '',
  author: 'MobiCova Health', tags: '', status: 'draft' as 'draft' | 'published',
  publishedAt: '', metaTitle: '', metaDescription: '',
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function BlogAdmin() {
  const qc = useQueryClient();
  const { data: posts } = useQuery({ queryKey: ['admin-blog'], queryFn: adminListBlog });
  const [editing, setEditing] = useState<null | typeof emptyPost>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-blog'] });

  // Upload an image to storage, then hand the public URL to the caller.
  const doUpload = async (file: File | undefined, onUrl: (url: string) => void) => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const url = await uploadBlogImage(file);
      onUrl(url);
    } catch (err) {
      setError(errMessage(err, 'Upload failed. You can paste an image URL instead.'));
    } finally { setUploading(false); }
  };
  const openNew = () => { setError(''); setEditing({ ...emptyPost }); };
  const openEdit = (p: AdminBlogPost) => {
    setError('');
    setEditing({
      id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, body: p.body,
      coverImageUrl: p.cover_image_url, author: p.author, tags: (p.tags || []).join(', '),
      status: p.status, publishedAt: toLocalInput(p.published_at),
      metaTitle: p.meta_title, metaDescription: p.meta_description,
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true); setError('');
    const payload = {
      title: editing.title, slug: editing.slug, excerpt: editing.excerpt, body: editing.body,
      coverImageUrl: editing.coverImageUrl, author: editing.author,
      tags: editing.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status: editing.status,
      publishedAt: editing.publishedAt ? new Date(editing.publishedAt).toISOString() : null,
      metaTitle: editing.metaTitle, metaDescription: editing.metaDescription,
    };
    try {
      if (editing.id) await adminUpdateBlog(editing.id, payload);
      else await adminCreateBlog(payload);
      setEditing(null);
      refresh();
    } catch (err) {
      setError(errMessage(err, 'Could not save the post.'));
    } finally { setBusy(false); }
  };

  const remove = async (p: AdminBlogPost) => {
    if (!confirm(`Permanently delete "${p.title}"? This cannot be undone.`)) return;
    await adminDeleteBlog(p.id);
    refresh();
  };

  const stateBadge = (s: string) => s === 'live' ? 'badge-green' : s === 'scheduled' ? 'badge-amber' : 'badge-gray';

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{posts?.length ?? 0} posts · public blog at /blog</span>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ New post</button>
      </div>
      <table className="table">
        <thead>
          <tr><th>Title</th><th>State</th><th>Publish date</th><th>Tags</th><th></th></tr>
        </thead>
        <tbody>
          {posts?.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.title}</strong><div className="muted small">/blog/{p.slug}</div></td>
              <td><span className={`badge ${stateBadge(p.state)}`}>{p.state}</span></td>
              <td className="muted small">{p.published_at ? new Date(p.published_at).toLocaleString() : '—'}</td>
              <td className="muted small">{(p.tags || []).join(', ')}</td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                {p.state === 'live' && <a className="btn btn-secondary btn-sm" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">View</a>}
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!posts || posts.length === 0) && <p className="empty-state">No posts yet. Write your first one.</p>}

      {editing && (
        <div className="drawer-overlay" onClick={() => setEditing(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editing.id ? 'Edit post' : 'New post'}</h3>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group form-span-2">
                <label>Title</label>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Slug (URL) — leave blank to auto-generate</label>
                <input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="from title" />
              </div>
              <div className="form-group">
                <label>Author</label>
                <input value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label>Cover image — upload or paste a URL</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input style={{ flex: '1 1 260px' }} value={editing.coverImageUrl} onChange={(e) => setEditing({ ...editing, coverImageUrl: e.target.value })} placeholder="https://…/image.jpg" />
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading ? 'Uploading…' : '⬆ Upload'}
                    <input type="file" accept="image/*" hidden disabled={uploading}
                      onChange={(e) => doUpload(e.target.files?.[0], (url) => setEditing((ed) => ed ? { ...ed, coverImageUrl: url } : ed))} />
                  </label>
                </div>
                {editing.coverImageUrl && <img src={editing.coverImageUrl} alt="cover preview" style={{ maxHeight: 90, marginTop: 8, borderRadius: 8 }} />}
              </div>
              <div className="form-group form-span-2">
                <label>Excerpt (short summary — also used for SEO if no meta description)</label>
                <textarea rows={2} value={editing.excerpt} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Body (Markdown — # heading, **bold**, ![alt](image-url), [link](url))</span>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading ? 'Uploading…' : '⬆ Upload image into body'}
                    <input type="file" accept="image/*" hidden disabled={uploading}
                      onChange={(e) => doUpload(e.target.files?.[0], (url) => setEditing((ed) => ed ? { ...ed, body: `${ed.body}\n\n![image](${url})\n` } : ed))} />
                  </label>
                </label>
                <textarea rows={12} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} style={{ fontFamily: 'monospace' }} />
              </div>
              <div className="form-group form-span-2">
                <label>Tags (comma-separated)</label>
                <input value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} placeholder="health, malaria, partners" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'draft' | 'published' })}>
                  <option value="draft">Draft (hidden)</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="form-group">
                <label>Publish date &amp; time (future = scheduled)</label>
                <input type="datetime-local" value={editing.publishedAt} onChange={(e) => setEditing({ ...editing, publishedAt: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label>SEO meta title (optional — defaults to title)</label>
                <input value={editing.metaTitle} onChange={(e) => setEditing({ ...editing, metaTitle: e.target.value })} />
              </div>
              <div className="form-group form-span-2">
                <label>SEO meta description (optional — defaults to excerpt)</label>
                <textarea rows={2} value={editing.metaDescription} onChange={(e) => setEditing({ ...editing, metaDescription: e.target.value })} />
              </div>
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              To <strong>schedule</strong>: set Status = Published and pick a future date — it appears automatically then.
              Published with no date = live now.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !editing.title}>
                {busy ? 'Saving…' : 'Save post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Buddy Safety review ---------------- */

function SafetyAdmin() {
  const [days, setDays] = useState(30);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['admin-buddy-safety', days],
    queryFn: () => adminBuddySafety(days),
    refetchOnWindowFocus: false,
  });

  const badge = (s: string) =>
    s === 'crisis' ? 'badge-red' : s === 'emergency' ? 'badge-red' : 'badge-amber';

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">
          Conversations the safety layer flagged — crisis / emergency / distress (read-only)
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Loading…' : 'Refresh'}
          </button>
        </span>
      </div>

      {data && (
        <p style={{ display: 'flex', gap: 8, margin: '4px 0 12px' }}>
          <span className="badge badge-red">crisis {data.byType.crisis ?? 0}</span>
          <span className="badge badge-red">emergency {data.byType.emergency ?? 0}</span>
          <span className="badge badge-amber">distress {data.byType.distress ?? 0}</span>
        </p>
      )}

      <table className="table">
        <thead>
          <tr><th>When</th><th>Type</th><th>Channel</th><th>Message</th><th>Session</th></tr>
        </thead>
        <tbody>
          {data?.items.map((it) => (
            <tr key={it.id}>
              <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{new Date(it.created_at).toLocaleString()}</td>
              <td><span className={`badge ${badge(it.safety)}`}>{it.safety}</span></td>
              <td className="muted small">{it.channel}</td>
              <td>{it.content}</td>
              <td className="muted small" title={it.session_key}>{it.session_key.slice(0, 8)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && data.items.length === 0 && (
        <p className="empty-state">No flagged conversations in this period. 🟢</p>
      )}
      <p className="muted small" style={{ marginTop: 12 }}>
        These are anonymous sessions (no account, no personal details). Use this to monitor that the
        safety net is firing and to spot patterns — not to identify individuals.
      </p>
    </div>
  );
}

/* ---------------- System (AI health) ---------------- */

function SystemAdmin() {
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ['admin-ai-status'],
    queryFn: adminAiStatus,
    refetchOnWindowFocus: false,
  });

  const ok = data?.working;
  const badgeClass = data
    ? (ok ? 'badge-green' : (data.configured ? 'badge-red' : 'badge-gray'))
    : 'badge-gray';
  const badgeText = data
    ? (ok ? 'Working' : (data.configured ? 'Failing' : 'Not configured'))
    : '…';

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">AI integration (Anthropic) — Health Buddy &amp; triage</span>
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Checking…' : 'Re-check'}
        </button>
      </div>

      {error && <div className="notice notice-error">Could not run the check. {errMessage(error, '')}</div>}

      {data && (
        <div style={{ padding: '4px 4px 8px' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
            <span className={`badge ${badgeClass}`}>{badgeText}</span>
            {data.keyPresent && <span className="muted small">key {data.keyMasked}</span>}
          </p>
          <p style={{ margin: '0 0 14px' }}>{data.summary}</p>

          {data.models.length > 0 && (
            <table className="table">
              <thead>
                <tr><th>Used for</th><th>Model</th><th>Status</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {data.models.map((m) => (
                  <tr key={m.role}>
                    <td><strong>{m.role === 'buddy' ? 'Health Buddy' : 'Symptom triage'}</strong></td>
                    <td className="muted small">{m.model}</td>
                    <td><span className={`badge ${m.ok ? 'badge-green' : 'badge-red'}`}>{m.ok ? 'OK' : 'Error'}</span></td>
                    <td className="muted small">
                      {m.ok ? '—' : (m.detail
                        ? <>
                            <div>{[m.detail.status, m.detail.type].filter(Boolean).join(' ')} {m.detail.message}</div>
                            <div style={{ marginTop: 4 }}><strong>Fix:</strong> {m.detail.hint}</div>
                          </>
                        : 'Failed')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="muted small" style={{ marginTop: 12 }}>
            This makes a tiny live call to each model. The API key is read from the server and never shown in full.
            If the Buddy is “Failing”, fix it on the <strong>mobicova-api</strong> service in Render, then Re-check.
          </p>
        </div>
      )}
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
                <input value={editing.underwriter} onChange={(e) => setEditing({ ...editing, underwriter: e.target.value })} placeholder="e.g. Acme Health HMO" />
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
