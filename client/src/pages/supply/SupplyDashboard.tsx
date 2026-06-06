import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getSupplyOverview, getSupplyQueue } from '../../api/supply';
import { orgTypeLabel } from '../../lib/orgTypes';
import { formatDateTime, badgeClass, fulfilmentLabel, age } from '../../lib/format';
import './Supply.css';

// Dashboard for a SUPPLY-side org admin (clinic / pharmacy). Shows the work
// routed to their org + headline counts — scoped to their org by the server.
export default function SupplyDashboard() {
  const { data: overview } = useQuery({ queryKey: ['supply-overview'], queryFn: getSupplyOverview });
  const { data: queueData, isLoading } = useQuery({ queryKey: ['supply-queue'], queryFn: getSupplyQueue });
  const isPharmacy = (overview?.type || queueData?.type) === 'pharmacy';
  const queue = queueData?.queue ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>{overview?.name || 'Dashboard'}</h1>
        <p className="muted">{overview ? orgTypeLabel(overview.type) : 'Your organisation'} · work routed to you</p>
      </div>

      <div className="supply-stats">
        <div className="supply-stat">
          <div className="supply-stat-v">{overview?.queueCount ?? '—'}</div>
          <div className="supply-stat-l">{isPharmacy ? 'Open prescriptions' : 'Open consultations'}</div>
        </div>
        <div className="supply-stat">
          <div className="supply-stat-v">{overview?.staffCount ?? '—'}</div>
          <div className="supply-stat-l">{isPharmacy ? 'Pharmacists' : 'Doctors'}</div>
        </div>
        <Link className="supply-stat supply-stat-link" to="/staff">
          <div className="supply-stat-v">＋</div>
          <div className="supply-stat-l">Manage staff</div>
        </Link>
      </div>

      <div className="card">
        <h3 className="supply-sec">{isPharmacy ? 'Prescription queue' : 'Consultation queue'}</h3>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="empty-state">Nothing routed to you yet.</p>
        ) : isPharmacy ? (
          <table className="table">
            <thead><tr><th>Member</th><th>Medication</th><th>Method</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.member_name}</strong></td>
                  <td>{q.medication}<div className="muted small">{q.dosage}</div></td>
                  <td className="muted small">{q.fulfilment_method || '—'}</td>
                  <td><span className={`badge ${badgeClass(q.fulfilment_status || '')}`}>{fulfilmentLabel(q.fulfilment_status || '')}</span></td>
                  <td className="muted small">{formatDateTime(q.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="table">
            <thead><tr><th>Member</th><th>Reason</th><th>Status</th><th>Scheduled</th></tr></thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id}>
                  <td><strong>{q.member_name}</strong><div className="muted small">{q.gender || ''}{q.date_of_birth ? ` · ${age(q.date_of_birth)}` : ''}</div></td>
                  <td>{q.reason || '—'}{q.diagnosis ? <div className="muted small">{q.diagnosis}</div> : null}</td>
                  <td><span className={`badge ${badgeClass(q.status || '')}`}>{q.status}</span></td>
                  <td className="muted small">{formatDateTime(q.scheduled_at || q.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small supply-note">
          Clinicians action this work in the <strong>Provider portal</strong>. This view is your organisation’s oversight.
        </p>
      </div>
    </div>
  );
}
