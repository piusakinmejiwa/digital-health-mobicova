import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProviderPrescriptions, dispensePrescription } from '../../api/provider';
import { formatDateTime, badgeClass } from '../../lib/format';
import './Provider.css';

const STATUS_TABS = [
  { key: 'pending', label: 'To dispense' },
  { key: 'dispensed', label: 'Dispensed' },
  { key: '', label: 'All' },
];

export default function ProviderDispensaryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['prov-rx', tab],
    queryFn: () => getProviderPrescriptions(tab || undefined),
  });

  const counts = Object.fromEntries((data?.counts || []).map((c) => [c.status, c.count]));

  const dispense = async (id: string) => {
    setBusyId(id);
    try {
      await dispensePrescription(id);
      qc.invalidateQueries({ queryKey: ['prov-rx'] });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="prov-page">
      <div className="prov-page-head">
        <h1>Dispensary</h1>
        <p className="muted">Fulfil e-prescriptions routed to your pharmacy.</p>
      </div>

      <div className="prov-tabs">
        {STATUS_TABS.map((t) => (
          <button key={t.key} className={`prov-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key && counts[t.key] ? <span className="prov-tab-count">{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : data && data.prescriptions.length > 0 ? (
        <div className="prov-list">
          {data.prescriptions.map((p) => (
            <div key={p.id} className="prov-rx-row">
              <div className="prov-rx-row-main">
                <strong>{p.medication}</strong>
                <span className="muted small">{p.dosage}{p.instructions ? ` · ${p.instructions}` : ''}</span>
                <span className="muted small">
                  {p.member_name} · prescribed by {p.doctor_name || '—'}
                  {p.diagnosis ? ` · ${p.diagnosis}` : ''}
                </span>
              </div>
              <div className="prov-rx-row-meta">
                <span className="muted small">{formatDateTime(p.created_at)}</span>
                {p.fulfilment_status === 'pending' ? (
                  <button className="btn btn-primary" onClick={() => dispense(p.id)} disabled={busyId === p.id}>
                    {busyId === p.id ? 'Dispensing…' : 'Mark dispensed'}
                  </button>
                ) : (
                  <span className={`badge ${badgeClass(p.fulfilment_status)}`}>{p.fulfilment_status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Nothing here right now.</p>
      )}
    </div>
  );
}
