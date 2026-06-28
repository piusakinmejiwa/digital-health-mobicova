import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { Partner, InsurancePlan } from '../../types';
import {
  adminListPartners, adminCreatePartner, adminUpdatePartner, adminDeletePartner,
  adminListPlans, adminCreatePlan, adminUpdatePlan, adminDeletePlan,
  adminAiStatus, adminBuddySafety,
  adminListChallenges, adminCreateChallenge, adminUpdateChallenge, adminDeleteChallenge,
} from '../../api/admin';
import { CatalogueAdmin, RedemptionsAdmin } from './RewardsCatalogueAdmin';
import {
  adminListBlog, adminCreateBlog, adminUpdateBlog, adminDeleteBlog, uploadBlogImage, type AdminBlogPost,
} from '../../api/blog';
import PartnerDoctorsModal from '../../components/admin/PartnerDoctorsModal';
import { adminListContactMessages, adminDeleteContactMessage } from '../../api/contact';
import { adminListPageAssets, adminSavePageAsset, adminGenerateImage } from '../../api/pageAssets';
import { adminListNewsletter, adminDeleteNewsletter } from '../../api/newsletter';
import { naira } from '../../lib/format';
import OrgsAdmin from './OrgsAdmin';
import UsersAdmin from './UsersAdmin';
import ProvidersAdmin from './ProvidersAdmin';
import AuditAdmin from './AuditAdmin';
import HealthTipsAdmin from './HealthTipsAdmin';
import './Admin.css';

const PLAN_TYPES = ['individual', 'family', 'hospital_cash', 'group', 'wellness'];
const PARTNER_CATEGORIES = ['telemedicine', 'insurer', 'pharmacy', 'diagnostics', 'ehr', 'distribution'];

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

type AdminTab = 'organisations' | 'users' | 'providers' | 'plans' | 'partners' | 'blog' | 'images' | 'messages' | 'newsletter' | 'healthtips' | 'challenges' | 'audit' | 'safety' | 'system';

// Tabs grouped into categories so the bar stays short: pick a category, then a
// sub-tab within it.
const TAB_GROUPS: { label: string; tabs: { key: AdminTab; label: string }[] }[] = [
  { label: 'Tenants', tabs: [
    { key: 'organisations', label: 'Organisations' },
    { key: 'users', label: 'Users' },
    { key: 'providers', label: 'Providers' },
  ] },
  { label: 'Catalog', tabs: [
    { key: 'plans', label: 'Insurance plans' },
    { key: 'partners', label: 'Partners' },
  ] },
  { label: 'Content', tabs: [
    { key: 'blog', label: 'Blog' },
    { key: 'images', label: 'Page Images' },
    { key: 'healthtips', label: 'Health Tips' },
    { key: 'challenges', label: 'Rewards' },
  ] },
  { label: 'Contacts', tabs: [
    { key: 'messages', label: 'Messages' },
    { key: 'newsletter', label: 'Newsletter' },
  ] },
  { label: 'System', tabs: [
    { key: 'audit', label: 'Audit log' },
    { key: 'safety', label: 'Buddy Safety' },
    { key: 'system', label: 'System' },
  ] },
];

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('organisations');
  const activeGroup = TAB_GROUPS.find((g) => g.tabs.some((t) => t.key === tab)) ?? TAB_GROUPS[0];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Platform admin</h1>
          <p>Onboard partner organisations and their users, and manage the platform-wide insurance plans and partner ecosystem.</p>
        </div>
      </div>

      {/* Primary: category groups */}
      <div className="tabs tabs-groups">
        {TAB_GROUPS.map((g) => (
          <button
            key={g.label}
            className={`tab ${activeGroup.label === g.label ? 'active' : ''}`}
            onClick={() => setTab(g.tabs[0].key)}
          >
            {g.label}
          </button>
        ))}
      </div>
      {/* Secondary: sub-tabs within the active group */}
      <div className="tabs tabs-sub">
        {activeGroup.tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'organisations' && <OrgsAdmin />}
      {tab === 'users' && <UsersAdmin />}
      {tab === 'providers' && <ProvidersAdmin />}
      {tab === 'plans' && <PlansAdmin />}
      {tab === 'partners' && <PartnersAdmin />}
      {tab === 'blog' && <BlogAdmin />}
      {tab === 'images' && <PageImagesAdmin />}
      {tab === 'messages' && <MessagesAdmin />}
      {tab === 'newsletter' && <NewsletterAdmin />}
      {tab === 'healthtips' && <HealthTipsAdmin />}
      {tab === 'challenges' && <RewardsAdmin />}
      {tab === 'audit' && <AuditAdmin />}
      {tab === 'safety' && <SafetyAdmin />}
      {tab === 'system' && <SystemAdmin />}
    </div>
  );
}

/* ---------------- Page hero images (AI generate) ---------------- */

const STYLE = ' Photorealistic, 3:2 landscape, warm natural light, authentic Nigerian / West African setting, hopeful and professional, no text or logos.';
const PAGE_IMAGES: { slug: string; label: string; prompt: string }[] = [
  { slug: 'about', label: 'About', prompt: 'Diverse Nigerian healthcare workers and community members smiling together outside a modern clinic, documentary style.' },
  { slug: 'health-tips', label: 'Daily Health Tips', prompt: 'A happy young Nigerian person reading a friendly health tip notification on their phone, bright cheerful lifestyle, wellness.' },
  { slug: 'partners', label: 'Partners', prompt: 'Two African business professionals (insurer / HMO) shaking hands in a bright modern Lagos office, warm and corporate.' },
  { slug: 'careers', label: 'Careers', prompt: 'A young, diverse African tech team collaborating around laptops in a bright modern startup office, energetic.' },
  { slug: 'contact', label: 'Contact', prompt: 'A friendly African customer-support professional wearing a headset and smiling in a modern office.' },
  { slug: 'telemedicine', label: 'Telemedicine', prompt: 'A Nigerian doctor in a white coat conducting a video consultation on a smartphone, and a patient at home using a phone.' },
  { slug: 'insurance', label: 'Insurance', prompt: 'A relieved African family reviewing a health plan on a phone with a friendly agent, reassuring and bright.' },
  { slug: 'channels', label: 'Channels', prompt: 'Close-up of African hands holding a basic feature phone showing a menu, next to a smartphone, in a market setting.' },
  { slug: 'developers', label: 'Developers', prompt: 'Over-the-shoulder view of an African software developer coding on a laptop with a phone showing an app, focused.' },
  { slug: 'webhooks', label: 'Webhooks', prompt: 'An African developer at multiple monitors with data dashboards in a modern dev workspace.' },
  { slug: 'pricing', label: 'Pricing', prompt: 'An African business owner reviewing pricing options on a tablet, thoughtful, in a bright office.' },
  { slug: 'security', label: 'Security', prompt: 'A confident African IT / security professional in a modern, secure office environment, trustworthy.' },
  { slug: 'newsletter', label: 'Newsletter (home)', prompt: 'A happy young Nigerian person reading good news on their phone with a coffee, bright and inviting, lifestyle.' },
];

function PageImagesAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-page-assets'], queryFn: adminListPageAssets });
  const ready = !!data?.generatorReady;
  const saved = new Map((data?.assets || []).map((a) => [a.slug, a]));
  const [draft, setDraft] = useState<Record<string, { prompt: string; preview: string }>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const get = (slug: string, fallback: string) => draft[slug] || { prompt: saved.get(slug)?.prompt || fallback, preview: '' };
  const patch = (slug: string, fallback: string, p: Partial<{ prompt: string; preview: string }>) =>
    setDraft((d) => ({ ...d, [slug]: { ...get(slug, fallback), ...p } }));
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-page-assets'] }); qc.invalidateQueries({ queryKey: ['page-assets'] }); };

  const generate = async (slug: string, fallback: string) => {
    setBusy(`${slug}:gen`); setError('');
    try { const url = await adminGenerateImage(get(slug, fallback).prompt + STYLE); patch(slug, fallback, { preview: url }); }
    catch (e) { setError(errMessage(e, 'Generation failed.')); }
    finally { setBusy(''); }
  };
  const save = async (slug: string, fallback: string, url: string) => {
    setBusy(`${slug}:save`); setError('');
    try { await adminSavePageAsset(slug, url, get(slug, fallback).prompt); patch(slug, fallback, { preview: '' }); refresh(); }
    catch (e) { setError(errMessage(e, 'Could not save.')); }
    finally { setBusy(''); }
  };

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">Hero images for the public content pages</span>
        <span className={`badge ${ready ? 'badge-green' : 'badge-amber'}`}>
          {ready ? `AI generator: ${data?.provider}` : 'AI generator off — set OPENAI_API_KEY'}
        </span>
      </div>
      {error && <div className="notice notice-error">{error}</div>}

      {PAGE_IMAGES.map((p) => {
        const cur = saved.get(p.slug)?.image_url;
        const d = get(p.slug, p.prompt);
        return (
          <div key={p.slug} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, padding: '14px 0', borderTop: '1px solid #eef2f2', alignItems: 'start' }}>
            <div>
              <strong>{p.label}</strong>
              <div className="muted small">/{p.slug}</div>
              {(d.preview || cur)
                ? <img src={d.preview || cur} alt={p.label} style={{ width: 150, height: 100, objectFit: 'cover', borderRadius: 8, marginTop: 6 }} />
                : <div style={{ width: 150, height: 100, borderRadius: 8, marginTop: 6, background: 'linear-gradient(135deg,#0A7B7B,#0E2A2A)' }} />}
              {d.preview && <div className="muted small" style={{ color: '#b8860b' }}>preview — not saved</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea rows={2} value={d.prompt} onChange={(e) => patch(p.slug, p.prompt, { prompt: e.target.value })} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" disabled={!ready || !!busy} onClick={() => generate(p.slug, p.prompt)}>
                  {busy === `${p.slug}:gen` ? 'Generating…' : '✨ Generate'}
                </button>
                {d.preview && (
                  <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => save(p.slug, p.prompt, d.preview)}>
                    {busy === `${p.slug}:save` ? 'Saving…' : 'Use this image'}
                  </button>
                )}
                {cur && <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => save(p.slug, p.prompt, '')}>Remove (use illustration)</button>}
              </div>
            </div>
          </div>
        );
      })}
      <p className="muted small" style={{ marginTop: 12 }}>
        Generate creates an image, uploads it to your storage bucket, and shows a preview. Click <strong>Use this image</strong> to set it
        as the page hero. You can also edit the prompt and regenerate until you’re happy.
      </p>
    </div>
  );
}

/* ---------------- Newsletter ---------------- */

function NewsletterAdmin() {
  const qc = useQueryClient();
  const { data: signups, isFetching, refetch } = useQuery({
    queryKey: ['admin-newsletter'],
    queryFn: adminListNewsletter,
    refetchOnWindowFocus: false,
  });
  const remove = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from the newsletter list?`)) return;
    await adminDeleteNewsletter(id);
    qc.invalidateQueries({ queryKey: ['admin-newsletter'] });
  };
  const csv = () => {
    const rows = [['Name', 'Email', 'Phone', 'Signed up'], ...(signups || []).map((s) => [s.name, s.email, s.phone, new Date(s.created_at).toISOString()])];
    const blob = new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'mobicova-newsletter.csv'; a.click();
  };
  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{signups?.length ?? 0} newsletter subscribers</span>
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={csv} disabled={!signups?.length}>Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Loading…' : 'Refresh'}</button>
        </span>
      </div>
      <table className="table">
        <thead><tr><th>Signed up</th><th>Name</th><th>Email</th><th>Phone</th><th></th></tr></thead>
        <tbody>
          {signups?.map((s) => (
            <tr key={s.id}>
              <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{new Date(s.created_at).toLocaleString()}</td>
              <td>{s.name || '—'}</td>
              <td>{s.email}</td>
              <td className="muted small">{s.phone || '—'}</td>
              <td className="admin-actions"><button className="btn btn-danger btn-sm" onClick={() => remove(s.id, s.email)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {signups && signups.length === 0 && <p className="empty-state">No subscribers yet.</p>}
    </div>
  );
}

/* ---------------- Contact messages ---------------- */

function MessagesAdmin() {
  const qc = useQueryClient();
  const { data: messages, isFetching, refetch } = useQuery({
    queryKey: ['admin-contact-messages'],
    queryFn: adminListContactMessages,
    refetchOnWindowFocus: false,
  });
  const remove = async (id: string, who: string) => {
    if (!confirm(`Delete the message from ${who}? This cannot be undone.`)) return;
    await adminDeleteContactMessage(id);
    qc.invalidateQueries({ queryKey: ['admin-contact-messages'] });
  };
  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{messages?.length ?? 0} contact-form messages</span>
        <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <table className="table">
        <thead>
          <tr><th>When</th><th>From</th><th>Type</th><th>Subject</th><th>Message</th><th></th></tr>
        </thead>
        <tbody>
          {messages?.map((m) => (
            <tr key={m.id}>
              <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString()}</td>
              <td>
                <strong>{m.name || '—'}</strong>
                <div className="muted small">{m.email}{m.phone ? ` · ${m.phone}` : ''}</div>
                {m.organisation && <div className="muted small">{m.organisation}</div>}
              </td>
              <td className="muted small">{m.enquiry_type || '—'}</td>
              <td className="muted small">{m.subject || '—'}</td>
              <td style={{ maxWidth: 360 }}>{m.message}</td>
              <td className="admin-actions">
                <button className="btn btn-danger btn-sm" onClick={() => remove(m.id, m.name || m.email)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {messages && messages.length === 0 && <p className="empty-state">No messages yet.</p>}
    </div>
  );
}

/* ---------------- Blog ---------------- */

type PublishMode = 'draft' | 'now' | 'schedule';
const emptyPost = {
  id: '' as string | undefined, title: '', slug: '', excerpt: '', body: '', coverImageUrl: '',
  author: 'MobiCova Health', tags: '', publishMode: 'draft' as PublishMode,
  scheduleAt: '', origPublishedAt: null as string | null, metaTitle: '', metaDescription: '',
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
  const [coverBusy, setCoverBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-blog'] });

  // Generate a cover image with AI (from the post title) → set it as the cover.
  const genCover = async () => {
    const title = (editing?.title || '').trim();
    if (title.length < 4) { setError('Add a title first — it is used as the image prompt.'); return; }
    setCoverBusy(true); setError('');
    try {
      const url = await adminGenerateImage(
        `Editorial cover image for an African health article titled "${title}".${STYLE}`
      );
      setEditing((ed) => ed ? { ...ed, coverImageUrl: url } : ed);
    } catch (e) { setError(errMessage(e, 'Generation failed.')); }
    finally { setCoverBusy(false); }
  };

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
    const mode: PublishMode = p.state === 'scheduled' ? 'schedule' : p.state === 'live' ? 'now' : 'draft';
    setEditing({
      id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, body: p.body,
      coverImageUrl: p.cover_image_url, author: p.author, tags: (p.tags || []).join(', '),
      publishMode: mode, scheduleAt: p.state === 'scheduled' ? toLocalInput(p.published_at) : '',
      origPublishedAt: p.published_at, metaTitle: p.meta_title, metaDescription: p.meta_description,
    });
  };

  const save = async () => {
    if (!editing) return;
    if (editing.publishMode === 'schedule' && !editing.scheduleAt) {
      setError('Pick a date and time to schedule this post.');
      return;
    }
    setBusy(true); setError('');
    // Map the friendly publish choice → status + published_at.
    const status = editing.publishMode === 'draft' ? 'draft' : 'published';
    let publishedAt: string | null = null;
    if (editing.publishMode === 'schedule') publishedAt = new Date(editing.scheduleAt).toISOString();
    else if (editing.publishMode === 'now') publishedAt = editing.origPublishedAt ?? new Date().toISOString();
    const payload = {
      title: editing.title, slug: editing.slug, excerpt: editing.excerpt, body: editing.body,
      coverImageUrl: editing.coverImageUrl, author: editing.author,
      tags: editing.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status, publishedAt,
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
                  <button type="button" className="btn btn-secondary btn-sm" disabled={coverBusy || uploading} onClick={genCover}>
                    {coverBusy ? 'Generating…' : '✨ Generate'}
                  </button>
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
              <div className="form-group form-span-2">
                <label>Publishing</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
                    <input type="radio" name="pubmode" checked={editing.publishMode === 'draft'}
                      onChange={() => setEditing({ ...editing, publishMode: 'draft' })} />
                    <span><strong>Draft</strong> — hidden, not on the site</span>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
                    <input type="radio" name="pubmode" checked={editing.publishMode === 'now'}
                      onChange={() => setEditing({ ...editing, publishMode: 'now' })} />
                    <span><strong>Publish now</strong> — live immediately</span>
                  </label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
                    <input type="radio" name="pubmode" checked={editing.publishMode === 'schedule'}
                      onChange={() => setEditing({ ...editing, publishMode: 'schedule' })} />
                    <span><strong>Schedule for later</strong> — goes live automatically at a chosen time</span>
                  </label>
                </div>
                {editing.publishMode === 'schedule' && (
                  <div style={{ marginTop: 10 }}>
                    <label>Go live on (your local time)</label>
                    <input type="datetime-local" value={editing.scheduleAt}
                      onChange={(e) => setEditing({ ...editing, scheduleAt: e.target.value })} />
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      The post stays hidden until this time, then appears on the blog on its own — no further action needed.
                    </p>
                  </div>
                )}
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
  const [doctorsPartner, setDoctorsPartner] = useState<null | Partner>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-partners'] });
    qc.invalidateQueries({ queryKey: ['partners'] }); // public ecosystem page
    qc.invalidateQueries({ queryKey: ['admin-providers'] });
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
                {(p.category === 'telemedicine' || p.category === 'pharmacy') && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setDoctorsPartner(p)}>Doctors &amp; docs</button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(p)}>{p.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(!partners || partners.length === 0) && <p className="empty-state">No partners yet. Add one to get started.</p>}

      {doctorsPartner && (
        <PartnerDoctorsModal partner={doctorsPartner} onClose={() => setDoctorsPartner(null)} onChanged={refresh} />
      )}

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

// --- Rewards admin: Challenges | Catalogue | Redemptions ---
function RewardsAdmin() {
  const [sub, setSub] = useState<'challenges' | 'catalogue' | 'redemptions'>('challenges');
  return (
    <div>
      <div className="tabs tabs-sub" style={{ marginTop: 0 }}>
        <button className={`tab ${sub === 'challenges' ? 'active' : ''}`} onClick={() => setSub('challenges')}>Challenges</button>
        <button className={`tab ${sub === 'catalogue' ? 'active' : ''}`} onClick={() => setSub('catalogue')}>Catalogue</button>
        <button className={`tab ${sub === 'redemptions' ? 'active' : ''}`} onClick={() => setSub('redemptions')}>Redemptions</button>
      </div>
      {sub === 'challenges' && <ChallengesAdmin />}
      {sub === 'catalogue' && <CatalogueAdmin />}
      {sub === 'redemptions' && <RedemptionsAdmin />}
    </div>
  );
}

// --- Rewards challenges (Phase 2) ---
const CH_BLANK = { title: '', description: '', action: 'any', target: 1, window: 'weekly', bonusPoints: 25, isActive: true };

function ChallengesAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['admin-challenges'], queryFn: adminListChallenges });
  const [form, setForm] = useState<typeof CH_BLANK | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-challenges'] });

  const actions = data?.actions ?? ['any'];
  const windows = data?.windows ?? ['weekly', 'monthly', 'once'];

  const openNew = () => { setEditId(null); setForm({ ...CH_BLANK }); };
  const openEdit = (c: import('../../api/admin').RewardChallenge) => {
    setEditId(c.id);
    setForm({ title: c.title, description: c.description, action: c.action, target: c.target, window: c.window, bonusPoints: c.bonus_points, isActive: c.is_active });
  };
  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      if (editId) await adminUpdateChallenge(editId, form);
      else await adminCreateChallenge(form);
      setForm(null); refresh();
    } finally { setBusy(false); }
  };
  const remove = async (c: import('../../api/admin').RewardChallenge) => {
    if (!confirm(`Delete challenge "${c.title}"?`)) return;
    await adminDeleteChallenge(c.id); refresh();
  };
  const toggle = async (c: import('../../api/admin').RewardChallenge) => { await adminUpdateChallenge(c.id, { isActive: !c.is_active }); refresh(); };

  const challenges = data?.challenges ?? [];

  return (
    <div className="card">
      <div className="admin-toolbar">
        <span className="muted small">{challenges.length} challenge{challenges.length === 1 ? '' : 's'} · members earn the bonus when they hit the target in the window</span>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ New challenge</button>
      </div>
      <table className="table">
        <thead><tr><th>Title</th><th>Goal</th><th>Window</th><th>Bonus</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {challenges.map((c) => (
            <tr key={c.id} className={c.is_active ? '' : 'row-inactive'}>
              <td><strong>{c.title}</strong><div className="muted small">{c.description}</div></td>
              <td className="muted small">{c.target}× {c.action}</td>
              <td className="muted small">{c.window}</td>
              <td className="muted small">+{c.bonus_points}</td>
              <td><span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'active' : 'off'}</span></td>
              <td className="admin-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Edit</button>
                <button className="btn btn-secondary btn-sm" onClick={() => toggle(c)}>{c.is_active ? 'Disable' : 'Enable'}</button>
                <button className="btn btn-secondary btn-sm" onClick={() => remove(c)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {challenges.length === 0 && <p className="empty-state">No challenges yet. Create one to start nudging members.</p>}

      {form && (
        <div className="drawer-overlay" onClick={() => setForm(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editId ? 'Edit challenge' : 'New challenge'}</h3>
            <div className="form-grid">
              <div className="form-group form-span-2">
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Check in 5 days this week" />
              </div>
              <div className="form-group form-span-2">
                <label>Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Shown to members" />
              </div>
              <div className="form-group">
                <label>Counts which action</label>
                <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                  {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Window</label>
                <select value={form.window} onChange={(e) => setForm({ ...form, window: e.target.value })}>
                  {windows.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Target count</label>
                <input type="number" min={1} value={form.target} onChange={(e) => setForm({ ...form, target: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label>Bonus points</label>
                <input type="number" min={0} value={form.bonusPoints} onChange={(e) => setForm({ ...form, bonusPoints: Number(e.target.value) })} />
              </div>
              <label className="checkbox-row form-span-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>Active</span>
              </label>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={busy || !form.title.trim()}>{busy ? 'Saving…' : 'Save challenge'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
