import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProviderPrescriptions, advancePrescription } from '../../api/provider';
import { formatDateTime, badgeClass, fulfilmentLabel } from '../../lib/format';
import type { ProviderPrescription } from '../../types';
import './Provider.css';

const STATUS_TABS = [
  { key: 'pending', label: 'To dispense' },
  { key: 'ready', label: 'Ready' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: '', label: 'All' },
];

export default function ProviderDispensaryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [courier, setCourier] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ['prov-rx', tab],
    queryFn: () => getProviderPrescriptions(tab || undefined),
  });

  const counts = Object.fromEntries((data?.counts || []).map((c) => [c.status, c.count]));

  const advance = async (
    id: string,
    status: 'ready' | 'out_for_delivery' | 'collected' | 'delivered'
  ) => {
    setBusyId(id);
    try {
      await advancePrescription(
        id,
        status,
        status === 'out_for_delivery' && courier[id] ? { courierName: courier[id] } : undefined
      );
      qc.invalidateQueries({ queryKey: ['prov-rx'] });
    } finally {
      setBusyId(null);
    }
  };

  // Contextual action(s) for a row, based on its fulfilment status + the member's
  // chosen method. When no method is chosen yet, offer both collection + delivery.
  const actions = (p: ProviderPrescription) => {
    const s = p.fulfilment_status;
    const busy = busyId === p.id;
    const method = p.fulfilment_method || '';

    if (s === 'pending') {
      return (
        <button className="btn btn-primary" onClick={() => advance(p.id, 'ready')} disabled={busy}>
          {busy ? 'Saving…' : 'Mark ready'}
        </button>
      );
    }
    if (s === 'ready' || s === 'dispensed') {
      const showDeliver = method === 'delivery' || method === '';
      const showCollect = method === 'pickup' || method === '';
      return (
        <div className="prov-rx-acts">
          {showDeliver && (
            <>
              <input
                className="prov-rx-courier-in"
                placeholder="Courier (optional)"
                value={courier[p.id] || ''}
                onChange={(e) => setCourier((c) => ({ ...c, [p.id]: e.target.value }))}
              />
              <button className="btn btn-primary" onClick={() => advance(p.id, 'out_for_delivery')} disabled={busy}>
                {busy ? 'Saving…' : 'Out for delivery'}
              </button>
            </>
          )}
          {showCollect && (
            <button className="btn btn-secondary" onClick={() => advance(p.id, 'collected')} disabled={busy}>
              {busy ? 'Saving…' : 'Mark collected'}
            </button>
          )}
        </div>
      );
    }
    if (s === 'out_for_delivery') {
      return (
        <button className="btn btn-primary" onClick={() => advance(p.id, 'delivered')} disabled={busy}>
          {busy ? 'Saving…' : 'Mark delivered'}
        </button>
      );
    }
    return <span className={`badge ${badgeClass(s)}`}>{fulfilmentLabel(s)}</span>;
  };

  return (
    <div className="prov-page">
      <div className="prov-page-head">
        <h1>Dispensary</h1>
        <p className="muted">Fulfil e-prescriptions routed to your pharmacy — collection or courier delivery.</p>
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
                <span className="muted small">
                  {p.fulfilment_method === 'delivery'
                    ? `🛵 Deliver${p.delivery_address ? ` to ${p.delivery_address}` : ''}`
                    : p.fulfilment_method === 'pickup'
                    ? '🏪 Collection at pharmacy'
                    : '⏳ Awaiting member’s pickup/delivery choice'}
                  {p.tracking_ref ? ` · ${p.courier_name || 'Courier'} ${p.tracking_ref}` : ''}
                </span>
              </div>
              <div className="prov-rx-row-meta">
                <span className="muted small">{formatDateTime(p.created_at)}</span>
                {actions(p)}
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
