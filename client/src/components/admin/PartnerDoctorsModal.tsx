import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { Partner } from '../../types';
import {
  adminBulkImportProviders, adminListPartnerDocuments, adminUploadPartnerDocument,
  adminDeletePartnerDocument, type ProviderImportResult, type OrgDocument,
} from '../../api/admin';
import './OrgOnboarding.css';

const TEMPLATE = 'fullName,email,mdcnNumber,specialty,phone,role\nDr. Ada Obi,ada.obi@example.com,MDCN/12345,Cardiology,+2348012345678,doctor\n';

// Minimal CSV → records (header row → keys). Doctor data has no commas in fields.
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => { rec[h] = (cells[i] || '').trim(); });
    return rec;
  });
}

function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function PartnerDoctorsModal({ partner, onClose, onChanged }: {
  partner: Partner; onClose: () => void; onChanged: () => void;
}) {
  const [tab, setTab] = useState<'doctors' | 'documents'>('doctors');
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide ob-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ob-head">
          <div><h3>Doctors &amp; docs — {partner.name}</h3></div>
          <button className="ob-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="od-tabs">
          <button className={tab === 'doctors' ? 'on' : ''} onClick={() => setTab('doctors')}>Bulk import doctors</button>
          <button className={tab === 'documents' ? 'on' : ''} onClick={() => setTab('documents')}>Compliance documents</button>
        </div>
        <div className="ob-body">
          {tab === 'doctors' && <DoctorsTab partner={partner} onImported={onChanged} />}
          {tab === 'documents' && <DocsTab partner={partner} />}
        </div>
      </div>
    </div>
  );
}

// ── Bulk import doctors ──────────────────────────────────────────────────────
function DoctorsTab({ partner, onImported }: { partner: Partner; onImported: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dry, setDry] = useState<ProviderImportResult | null>(null);
  const [result, setResult] = useState<ProviderImportResult | null>(null);

  const onFile = async (file: File) => {
    setError(''); setDry(null); setResult(null);
    try {
      const recs = parseCsv(await file.text());
      if (recs.length === 0) { setError('No data rows found. The first row should be the header.'); return; }
      if (!('fullName' in recs[0]) || !('email' in recs[0])) { setError('CSV must have at least fullName and email columns.'); return; }
      setRows(recs); setFileName(file.name);
    } catch { setError('Could not read that file. Upload a plain CSV.'); }
  };

  const run = async (dryRun: boolean) => {
    setBusy(true); setError('');
    try {
      const res = await adminBulkImportProviders(partner.id, rows as unknown as Record<string, unknown>[], dryRun);
      if (dryRun) setDry(res);
      else { setResult(res); setDry(null); onImported(); }
    } catch (err) { setError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Import failed.') : 'Import failed.'); }
    finally { setBusy(false); }
  };

  const downloadCreds = () => {
    if (!result?.credentials?.length) return;
    const csv = 'fullName,email,tempPassword\n' + result.credentials.map((c) => `${c.fullName},${c.email},${c.tempPassword}`).join('\n') + '\n';
    download(`${partner.name.replace(/\W+/g, '-')}-doctor-logins.csv`, csv);
  };

  return (
    <>
      <p className="muted small ob-intro">
        Register many doctors / professionals into <strong>{partner.name}</strong> at once. Required columns: <code>fullName</code>, <code>email</code>.
        Optional: <code>mdcnNumber</code>, <code>specialty</code>, <code>phone</code>, <code>role</code> (doctor/pharmacist). Each gets a temporary password you can hand out.
      </p>
      <div className="import-controls">
        <button className="btn btn-secondary btn-sm" onClick={() => ref.current?.click()}>{fileName ? 'Choose a different file' : 'Choose CSV file'}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => download('doctor-import-template.csv', TEMPLATE)}>Download template</button>
        {fileName && <span className="muted small">{fileName} · {rows.length} rows</span>}
        <input ref={ref} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
      {error && <div className="notice notice-error">{error}</div>}

      {dry && (
        <div className={`notice ${dry.wouldImport ? 'notice-success' : 'notice-error'}`} style={{ marginTop: 10 }}>
          ✓ Dry run — nothing saved. Would register <strong>{dry.wouldImport ?? 0}</strong> of {dry.total}
          {dry.skipped.length > 0 && ` · ${dry.skipped.length} skipped`}.
          {dry.skipped.length > 0 && (
            <ul className="rx-list" style={{ marginTop: 8 }}>
              {dry.skipped.slice(0, 30).map((s) => <li key={s.row}><strong>Row {s.row}</strong> — {s.reason}</li>)}
              {dry.skipped.length > 30 && <li className="muted small">…and {dry.skipped.length - 30} more.</li>}
            </ul>
          )}
        </div>
      )}

      {result && (
        <div className={`notice ${result.inserted ? 'notice-success' : 'notice-error'}`} style={{ marginTop: 10 }}>
          Registered <strong>{result.inserted ?? 0}</strong> of {result.total}{result.skipped.length > 0 && ` · ${result.skipped.length} skipped`}.
          {result.credentials && result.credentials.length > 0 && (
            <div style={{ marginTop: 8 }}>
              ⚠️ These temporary passwords are shown <strong>once</strong> — download and distribute them now.
              <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={downloadCreds}>Download logins (CSV)</button>
              </div>
            </div>
          )}
        </div>
      )}

      {rows.length > 0 && !result && (
        <div className="modal-actions">
          <button className="btn btn-secondary" disabled={busy} onClick={() => run(true)}>{busy ? 'Checking…' : 'Validate (dry run)'}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(false)}>{busy ? 'Registering…' : `Register ${rows.length} doctors`}</button>
        </div>
      )}
    </>
  );
}

// ── Compliance documents ─────────────────────────────────────────────────────
const DOC_TYPES = ['Operating licence', 'Accreditation', 'Indemnity insurance', 'MDCN register', 'Other'];

function fmtBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocsTab({ partner }: { partner: Partner }) {
  const ref = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<OrgDocument[]>([]);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState(DOC_TYPES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    adminListPartnerDocuments(partner.id)
      .then((r) => { setDocs(r.documents); setStorageEnabled(r.storageEnabled); })
      .catch(() => setError('Could not load documents.'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [partner.id]);

  const upload = async (file: File) => {
    setBusy(true); setError('');
    try { await adminUploadPartnerDocument(partner.id, file, docType); load(); }
    catch (err) { setError(axios.isAxiosError(err) ? (err.response?.data?.error || 'Upload failed.') : 'Upload failed.'); }
    finally { setBusy(false); }
  };
  const remove = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    await adminDeletePartnerDocument(partner.id, docId); load();
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (!storageEnabled) return <div className="notice notice-error">Document storage isn’t configured on this server.</div>;

  return (
    <>
      <p className="muted small ob-intro">Upload the network’s compliance documents (licence, accreditation, indemnity, MDCN register…). Stored privately.</p>
      <div className="import-controls">
        <select value={docType} onChange={(e) => setDocType(e.target.value)}>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Uploading…' : 'Upload document'}</button>
        <input ref={ref} type="file" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      {docs.length === 0 ? <p className="muted small">No documents yet.</p> : docs.map((d) => (
        <div key={d.id} className="od-doc">
          <span>📎 <strong>{d.docType}</strong> · {d.fileName} <span className="muted small">{fmtBytes(d.sizeBytes)}</span></span>
          <span>
            {d.url && <a className="btn btn-secondary btn-sm" href={d.url} target="_blank" rel="noreferrer">View</a>}
            <button className="btn btn-secondary btn-sm" onClick={() => remove(d.id)}>Delete</button>
          </span>
        </div>
      ))}
    </>
  );
}
