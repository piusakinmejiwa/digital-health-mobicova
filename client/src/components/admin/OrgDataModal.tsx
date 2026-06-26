import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { Organisation } from '../../types';
import {
  adminListOrgDocuments, adminUploadOrgDocument, adminDeleteOrgDocument,
  adminGetOrgHr, adminSaveOrgHr, adminSyncOrgHr, adminImportOrgMembers,
  type OrgDocument, type OrgHr,
} from '../../api/admin';
import type { MemberImportResult } from '../../api/resources';
import { parseMemberCsv } from '../../lib/csv';
import './OrgOnboarding.css';

const DOC_TYPES = [
  { key: 'cac_certificate', label: 'CAC certificate' },
  { key: 'tax_certificate', label: 'Tax certificate' },
  { key: 'staff_list', label: 'Staff list' },
  { key: 'company_id_template', label: 'Company ID template' },
];

type Tab = 'documents' | 'members' | 'hr';

export default function OrgDataModal({ org, onClose }: { org: Organisation; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('documents');
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide ob-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ob-head">
          <div><h3>Members &amp; data — {org.name}</h3></div>
          <button className="ob-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="od-tabs">
          <button className={tab === 'documents' ? 'on' : ''} onClick={() => setTab('documents')}>Documents</button>
          <button className={tab === 'members' ? 'on' : ''} onClick={() => setTab('members')}>Import members</button>
          <button className={tab === 'hr' ? 'on' : ''} onClick={() => setTab('hr')}>HR / payroll</button>
        </div>
        <div className="ob-body">
          {tab === 'documents' && <DocumentsTab org={org} />}
          {tab === 'members' && <MembersTab org={org} />}
          {tab === 'hr' && <HrTab org={org} />}
        </div>
      </div>
    </div>
  );
}

function fmtBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Documents ──────────────────────────────────────────────────────────────
function DocumentsTab({ org }: { org: Organisation }) {
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    adminListOrgDocuments(org.id)
      .then((r) => { setDocs(r.documents); setStorageEnabled(r.storageEnabled); })
      .catch(() => setError('Could not load documents.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [org.id]);

  const upload = async (docType: string, file: File) => {
    setBusyType(docType); setError('');
    try { await adminUploadOrgDocument(org.id, file, docType); load(); }
    catch (err) { setError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Upload failed.') : 'Upload failed.'); }
    finally { setBusyType(''); }
  };
  const remove = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    await adminDeleteOrgDocument(org.id, docId); load();
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (!storageEnabled) return <div className="notice notice-error">Document storage isn’t configured on this server. Set <code>SUPABASE_URL</code> + <code>SUPABASE_SERVICE_ROLE_KEY</code> and a private bucket to enable uploads.</div>;

  const others = docs.filter((d) => !DOC_TYPES.some((t) => t.key === d.docType));

  return (
    <>
      <p className="muted small ob-intro">Upload the organisation’s verification documents. Stored privately; download links are short-lived.</p>
      {error && <div className="notice notice-error">{error}</div>}
      {DOC_TYPES.map((t) => {
        const existing = docs.find((d) => d.docType === t.key);
        return <DocRow key={t.key} label={t.label} doc={existing} busy={busyType === t.key}
          onUpload={(f) => upload(t.key, f)} onDelete={existing ? () => remove(existing.id) : undefined} />;
      })}
      <DocRow label="Other document" busy={busyType === 'other'} onUpload={(f) => upload('other', f)} />
      {others.map((d) => (
        <div key={d.id} className="od-doc">
          <span>📎 {d.fileName} <span className="muted small">{fmtBytes(d.sizeBytes)}</span></span>
          <span>
            {d.url && <a className="btn btn-secondary btn-sm" href={d.url} target="_blank" rel="noreferrer">View</a>}
            <button className="btn btn-secondary btn-sm" onClick={() => remove(d.id)}>Delete</button>
          </span>
        </div>
      ))}
    </>
  );
}

function DocRow({ label, doc, busy, onUpload, onDelete }: {
  label: string; doc?: OrgDocument; busy?: boolean; onUpload: (f: File) => void; onDelete?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="od-doc">
      <span><strong>{label}</strong>{doc && <> · <span className="muted small">{doc.fileName} {fmtBytes(doc.sizeBytes)}</span></>}</span>
      <span>
        {doc?.url && <a className="btn btn-secondary btn-sm" href={doc.url} target="_blank" rel="noreferrer">View</a>}
        {onDelete && <button className="btn btn-secondary btn-sm" onClick={onDelete}>Delete</button>}
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Uploading…' : doc ? 'Replace' : 'Upload'}</button>
        <input ref={ref} type="file" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
      </span>
    </div>
  );
}

// ── Members import (CSV → this org) ──────────────────────────────────────────
function MembersTab({ org }: { org: Organisation }) {
  const ref = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dry, setDry] = useState<MemberImportResult | null>(null);
  const [result, setResult] = useState<MemberImportResult | null>(null);

  const onFile = async (file: File) => {
    setError(''); setDry(null); setResult(null);
    try {
      const parsed = parseMemberCsv(await file.text());
      if (!parsed.hasFullNameColumn) { setError('No "fullName" column found. Check the header row.'); return; }
      if (parsed.records.length === 0) { setError('No data rows found.'); return; }
      setRows(parsed.records); setFileName(file.name);
    } catch { setError('Could not read that file. Upload a plain CSV.'); }
  };

  const run = async (dryRun: boolean) => {
    setBusy(true); setError('');
    try {
      const res = await adminImportOrgMembers(org.id, rows as unknown as Record<string, unknown>[], dryRun);
      if (dryRun) setDry(res); else { setResult(res); setDry(null); }
    } catch (err) { setError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Import failed.') : 'Import failed.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <p className="muted small ob-intro">Import members straight into <strong>{org.name}</strong> from a CSV. Required column: <code>fullName</code>. Optional: phone, email, dateOfBirth (YYYY-MM-DD), gender, channel, bloodGroup, allergies, chronicConditions, currentMedications.</p>
      <div className="import-controls">
        <button className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()}>{fileName ? 'Choose a different file' : 'Choose CSV file'}</button>
        {fileName && <span className="muted small">{fileName} · {rows.length} rows</span>}
        <input ref={ref} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
      {error && <div className="notice notice-error">{error}</div>}

      {dry && (
        <div className={`notice ${dry.wouldImport ? 'notice-success' : 'notice-error'}`} style={{ marginTop: 10 }}>
          ✓ Dry run — nothing saved. Would import <strong>{dry.wouldImport ?? 0}</strong> of {dry.total}
          {dry.skipped.length > 0 && ` · ${dry.skipped.length} skipped`}
          {dry.warnings && dry.warnings.length > 0 && ` · ${dry.warnings.length} not contactable`}.
        </div>
      )}
      {result && (
        <div className={`notice ${result.inserted > 0 ? 'notice-success' : 'notice-error'}`} style={{ marginTop: 10 }}>
          Imported <strong>{result.inserted}</strong> of {result.total}
          {result.skipped.length > 0 && ` · ${result.skipped.length} skipped`}.
        </div>
      )}

      {rows.length > 0 && !result && (
        <div className="modal-actions">
          <button className="btn btn-secondary" disabled={busy} onClick={() => run(true)}>{busy ? 'Checking…' : 'Validate (dry run)'}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(false)}>{busy ? 'Importing…' : `Import ${rows.length} members`}</button>
        </div>
      )}
    </>
  );
}

// ── HR / payroll (generic scaffold) ──────────────────────────────────────────
function HrTab({ org }: { org: Organisation }) {
  const [hr, setHr] = useState<OrgHr | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => adminGetOrgHr(org.id).then(setHr).catch(() => setError('Could not load HR config.'));
  useEffect(() => { load(); }, [org.id]);

  if (!hr) return <p className="muted">Loading…</p>;
  const set = (k: keyof OrgHr, v: string) => setHr({ ...hr, [k]: v });

  const save = async () => {
    setBusy(true); setError(''); setMsg('');
    try {
      const r = await adminSaveOrgHr(org.id, { provider: hr.provider, apiBaseUrl: hr.apiBaseUrl, syncCadence: String(hr.syncCadence), apiKey: apiKey || undefined });
      setApiKey(''); setMsg(r.status === 'connected' ? 'Saved — connected ✓' : 'Saved.'); load();
    } catch (err) { setError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Could not save.') : 'Could not save.'); }
    finally { setBusy(false); }
  };
  const sync = async () => {
    setBusy(true); setError(''); setMsg('');
    try { const r = await adminSyncOrgHr(org.id); setMsg(r.note); load(); }
    catch (err) { setError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Sync failed.') : 'Sync failed.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <p className="muted small ob-intro">
        Connect the organisation’s HR / payroll system to keep members in sync.
        <span className={`badge ${hr.status === 'connected' ? 'badge-green' : 'badge-gray'}`} style={{ marginLeft: 8 }}>{hr.status}</span>
      </p>
      <div className="form-group ob-field"><label>Provider</label>
        <input value={hr.provider} placeholder="e.g. SeamlessHR, PaidHR, BambooHR" onChange={(e) => set('provider', e.target.value)} /></div>
      <div className="form-group ob-field"><label>API base URL</label>
        <input value={hr.apiBaseUrl} placeholder="https://api.hr-provider.com" onChange={(e) => set('apiBaseUrl', e.target.value)} /></div>
      <div className="form-group ob-field"><label>API key</label>
        <input type="password" value={apiKey} placeholder={hr.hasKey ? '•••••••• (stored — leave blank to keep)' : 'Paste the API key'} onChange={(e) => setApiKey(e.target.value)} /></div>
      <div className="form-group ob-field"><label>Sync cadence</label>
        <select value={hr.syncCadence} onChange={(e) => set('syncCadence', e.target.value)}>
          <option value="manual">Manual</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
        </select></div>

      {hr.lastSyncedAt && <p className="muted small">Last synced: {new Date(hr.lastSyncedAt).toLocaleString()}</p>}
      {error && <div className="notice notice-error">{error}</div>}
      {msg && <div className="notice notice-success">{msg}</div>}

      <div className="modal-actions">
        <button className="btn btn-secondary" disabled={busy || hr.status !== 'connected'} onClick={sync}>Sync now</button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save connection'}</button>
      </div>
      <p className="muted small">Live member sync to a specific HR system is scaffolded — for now, use the <strong>Import members</strong> tab. Credentials are stored securely and never shown back.</p>
    </>
  );
}
