import { useRef, useState } from 'react';
import axios from 'axios';
import { importMembers, type MemberImportResult } from '../../api/resources';
import { parseMemberCsv, type ParsedImport } from '../../lib/csv';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TEMPLATE_HEADERS = [
  'fullName', 'phone', 'email', 'dateOfBirth', 'gender', 'channel',
  'bloodGroup', 'allergies', 'chronicConditions', 'currentMedications',
];
const TEMPLATE_SAMPLE = [
  'Ada Obi', '+2348012345678', 'ada@example.com', '1990-04-12', 'female', 'app',
  'O+', 'Penicillin;Peanuts', 'Hypertension', 'Amlodipine 5mg',
];

// A row-level issue flagged client-side so the user sees problems before upload.
function rowIssue(rec: Record<string, string>): string | null {
  if (!rec.fullName || !rec.fullName.trim()) return 'Full name is required';
  if (rec.dateOfBirth && !DATE_RE.test(rec.dateOfBirth)) {
    return `Date of birth "${rec.dateOfBirth}" must be YYYY-MM-DD`;
  }
  return null;
}

function downloadTemplate() {
  const csv = `${TEMPLATE_HEADERS.join(',')}\n${TEMPLATE_SAMPLE.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mobicova-member-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function MemberImportModal({ onClose, onImported }: {
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<MemberImportResult | null>(null);
  const [dry, setDry] = useState<MemberImportResult | null>(null);

  const onFile = async (file: File) => {
    setError(''); setResult(null); setDry(null);
    try {
      const text = await file.text();
      const p = parseMemberCsv(text);
      setFileName(file.name);
      if (p.records.length === 0) {
        setError('That file has no data rows. Make sure the first row is a header and there is at least one member below it.');
        setParsed(null);
        return;
      }
      if (!p.hasFullNameColumn) {
        setError('No "fullName" column was recognised. Download the template for the expected headers.');
        setParsed(null);
        return;
      }
      setParsed(p);
    } catch {
      setError('Could not read that file. Please upload a plain CSV.');
      setParsed(null);
    }
  };

  const validRecords = parsed?.records.filter((r) => rowIssue(r) === null) ?? [];
  const invalidCount = (parsed?.records.length ?? 0) - validRecords.length;

  // Server-authoritative validation that writes nothing — run this first to
  // confirm exactly what would import before committing.
  const doDryRun = async () => {
    if (!parsed) return;
    setBusy(true); setError('');
    try {
      const res = await importMembers(parsed.records as unknown as Record<string, unknown>[], true);
      setDry(res);
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Validation failed.');
      else setError('Validation failed.');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    setBusy(true); setError('');
    try {
      // Send every parsed row; the server is the authority on validation and
      // returns which rows it skipped and why.
      const res = await importMembers(parsed.records as unknown as Record<string, unknown>[]);
      setResult(res);
      if (res.inserted > 0) onImported();
    } catch (err) {
      if (axios.isAxiosError(err)) setError(err.response?.data?.error || 'Import failed.');
      else setError('Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Import members from CSV</h3>

        {/* ---- Result view ---- */}
        {result ? (
          <>
            <div className={`notice ${result.inserted > 0 ? 'notice-success' : 'notice-error'}`}>
              Imported <strong>{result.inserted}</strong> of {result.total} rows
              {result.skipped.length > 0 && ` · ${result.skipped.length} skipped`}.
            </div>
            {result.skipped.length > 0 && (
              <div className="import-skipped">
                <p className="muted small">Skipped rows (fix these and re-import just those):</p>
                <ul className="rx-list">
                  {result.skipped.slice(0, 50).map((s) => (
                    <li key={s.row}><strong>Row {s.row}</strong> — {s.reason}</li>
                  ))}
                </ul>
                {result.skipped.length > 50 && <p className="muted small">…and {result.skipped.length - 50} more.</p>}
              </div>
            )}
            {result.warnings && result.warnings.length > 0 && (
              <div className="notice" style={{ marginTop: 10, background: '#fff8e6', borderColor: '#f0d48a', color: '#7a5b00' }}>
                ⚠️ <strong>{result.warnings.length}</strong> imported but not contactable (no phone or email — can&rsquo;t receive a login code):
                <ul className="rx-list" style={{ marginTop: 6 }}>
                  {result.warnings.slice(0, 50).map((w) => <li key={`w${w.row}`}>Row {w.row} — {w.reason}</li>)}
                </ul>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">
              Upload a CSV with a header row. Required column: <code>fullName</code>. Optional:
              {' '}phone, email, dateOfBirth (YYYY-MM-DD), gender, channel (app/whatsapp/ussd/web),
              {' '}bloodGroup, allergies, chronicConditions, currentMedications. List columns take
              {' '}several values separated by a semicolon (e.g. <code>Penicillin;Peanuts</code>).
            </p>

            <div className="import-controls">
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                {fileName ? 'Choose a different file' : 'Choose CSV file'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>Download template</button>
              {fileName && <span className="muted small">{fileName}</span>}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
              />
            </div>

            {error && <div className="notice notice-error">{error}</div>}

            {parsed && (
              <>
                <div className="import-summary">
                  <span className="badge badge-green">{validRecords.length} ready</span>
                  {invalidCount > 0 && <span className="badge badge-amber">{invalidCount} with issues</span>}
                  {parsed.unknownHeaders.length > 0 && (
                    <span className="muted small">Ignored columns: {parsed.unknownHeaders.join(', ')}</span>
                  )}
                </div>

                <div className="import-preview">
                  <table className="table">
                    <thead>
                      <tr><th>#</th><th>Full name</th><th>Phone</th><th>Email</th><th>DOB</th><th>Channel</th><th>Issue</th></tr>
                    </thead>
                    <tbody>
                      {parsed.records.slice(0, 10).map((r, i) => {
                        const issue = rowIssue(r);
                        return (
                          <tr key={i} className={issue ? 'row-inactive' : ''}>
                            <td className="muted small">{i + 1}</td>
                            <td>{r.fullName || <span className="muted">—</span>}</td>
                            <td className="muted small">{r.phone || '—'}</td>
                            <td className="muted small">{r.email || '—'}</td>
                            <td className="muted small">{r.dateOfBirth || '—'}</td>
                            <td className="muted small">{r.channel || 'app'}</td>
                            <td>{issue ? <span className="badge badge-amber">{issue}</span> : <span className="muted small">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {parsed.records.length > 10 && (
                    <p className="muted small">Showing first 10 of {parsed.records.length} rows.</p>
                  )}
                </div>
              </>
            )}

            {/* ---- Dry-run report (server validated, nothing written) ---- */}
            {dry && (
              <div className={`notice ${dry.wouldImport ? 'notice-success' : 'notice-error'}`} style={{ marginTop: 12 }}>
                ✓ Dry run — <strong>nothing was saved</strong>. The server would import{' '}
                <strong>{dry.wouldImport ?? 0}</strong> of {dry.total} rows
                {dry.skipped.length > 0 && ` · ${dry.skipped.length} would be skipped`}.
                {dry.skipped.length > 0 && (
                  <ul className="rx-list" style={{ marginTop: 8 }}>
                    {dry.skipped.slice(0, 50).map((s) => (
                      <li key={s.row}><strong>Row {s.row}</strong> — {s.reason}</li>
                    ))}
                    {dry.skipped.length > 50 && <li className="muted small">…and {dry.skipped.length - 50} more.</li>}
                  </ul>
                )}
                {dry.warnings && dry.warnings.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    ⚠️ <strong>{dry.warnings.length}</strong> would import but can&rsquo;t receive a login code (no phone or email):
                    <ul className="rx-list" style={{ marginTop: 6 }}>
                      {dry.warnings.slice(0, 50).map((w) => <li key={`w${w.row}`}>Row {w.row} — {w.reason}</li>)}
                      {dry.warnings.length > 50 && <li className="muted small">…and {dry.warnings.length - 50} more.</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-secondary"
                onClick={doDryRun}
                disabled={busy || !parsed}
              >
                {busy ? 'Checking…' : 'Validate (dry run)'}
              </button>
              <button
                className="btn btn-primary"
                onClick={doImport}
                disabled={busy || !parsed || validRecords.length === 0}
              >
                {busy ? 'Importing…' : `Import ${validRecords.length} member${validRecords.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
