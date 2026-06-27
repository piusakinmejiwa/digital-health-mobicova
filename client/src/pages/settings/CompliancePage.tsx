import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCompliance, acceptDpa, requestDataExport } from '../../api/compliance';
import { useAuth } from '../../context/AuthContext';
import { SUBPROCESSORS, COMPLIANCE, COMPLIANCE_BADGE } from '../../lib/trust';

// In-app tenant Compliance tab — the logged-in side of the Trust & Security
// Centre. Admins accept the DPA and request a data export; everyone can review
// the posture and sub-processors.
export default function CompliancePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, isLoading } = useQuery({ queryKey: ['compliance'], queryFn: getCompliance });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const doAccept = async () => {
    if (!confirm(`Accept the MobiCova Data Processing Agreement (v${data?.currentDpaVersion}) on behalf of ${user?.orgName}?`)) return;
    setBusy(true); setMsg('');
    try { await acceptDpa(); qc.invalidateQueries({ queryKey: ['compliance'] }); setMsg('DPA accepted and recorded.'); }
    catch { setMsg('Could not record acceptance.'); }
    finally { setBusy(false); }
  };

  const doExport = async () => {
    if (!confirm('Request a full export of your organisation’s data? Our team will prepare it and be in touch.')) return;
    setBusy(true); setMsg('');
    try { await requestDataExport(); qc.invalidateQueries({ queryKey: ['compliance'] }); setMsg('Data export requested — we’ll be in touch.'); }
    catch { setMsg('Could not submit the request.'); }
    finally { setBusy(false); }
  };

  if (isLoading || !data) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Compliance</h1>
          <p>Your data protection agreements, sub-processors and data rights. See our full <Link to="/trust">Trust &amp; Security Centre</Link>.</p>
        </div>
      </div>

      {msg && <div className="notice notice-success" style={{ marginBottom: 16 }}>{msg}</div>}

      {/* DPA */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Data Processing Agreement</h3>
        {data.dpa ? (
          <p className="muted small">
            Accepted <strong>v{data.dpa.version}</strong> by {data.dpa.acceptedName || 'an administrator'} on {fmtDate(data.dpa.acceptedAt)}.
            {!data.upToDate && <> A newer version (v{data.currentDpaVersion}) is available.</>}
          </p>
        ) : (
          <p className="muted small">Your organisation has not yet accepted the MobiCova Data Processing Agreement.</p>
        )}
        <p className="small">
          The DPA sets out how MobiCova processes personal and health data on your behalf — roles, security measures,
          sub-processors and data-subject rights — in line with the NDPA/NDPR and GDPR-equivalent practices.
        </p>
        {isAdmin ? (
          (!data.dpa || !data.upToDate) && (
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={doAccept}>
              {data.dpa ? `Accept updated DPA (v${data.currentDpaVersion})` : `Accept DPA (v${data.currentDpaVersion})`}
            </button>
          )
        ) : <p className="muted small">Only an organisation admin can accept the DPA.</p>}
        {data.dpa && data.upToDate && <span className="badge badge-green">Up to date</span>}
      </div>

      {/* Data export / rights */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Your data rights</h3>
        <p className="small">
          You can request a full export of your organisation’s data at any time. To erase data or exercise other
          rights, contact us via the <Link to="/trust">Trust &amp; Security Centre</Link>.
        </p>
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={doExport}>Request data export</button>
        )}
        {data.exports.length > 0 && (
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Requested</th><th>By</th><th>Scope</th><th>Status</th></tr></thead>
            <tbody>
              {data.exports.map((e) => (
                <tr key={e.id}>
                  <td className="muted small">{fmtDate(e.created_at)}</td>
                  <td className="small">{e.requester || '—'}</td>
                  <td className="small">{e.scope}</td>
                  <td><span className="badge badge-gray">{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Compliance posture */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 className="card-title">Compliance posture</h3>
        {COMPLIANCE.map((c) => {
          const badge = COMPLIANCE_BADGE[c.status];
          return (
            <div key={c.title} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #eef3f3' }}>
              <div>
                <strong className="small">{c.title}</strong>
                <div className="muted small">{c.detail}</div>
              </div>
              <span className={`badge ${badge.cls}`} style={{ flex: 'none', height: 'fit-content' }}>{badge.label}</span>
            </div>
          );
        })}
      </div>

      {/* Sub-processors */}
      <div className="card card-pad">
        <h3 className="card-title">Sub-processors</h3>
        <p className="muted small">Third parties that process data on our behalf to run the service.</p>
        <table className="table">
          <thead><tr><th>Provider</th><th>Purpose</th><th>Region</th></tr></thead>
          <tbody>
            {SUBPROCESSORS.map((s) => (
              <tr key={s.name}>
                <td><strong>{s.name}</strong></td>
                <td className="small">{s.purpose}</td>
                <td className="muted small">{s.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
