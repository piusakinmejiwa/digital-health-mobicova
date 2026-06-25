import { useState } from 'react';
import type { Prescription } from '../../types';
import { setPrescriptionFulfilment } from '../../api/member';
import { fulfilmentLabel, badgeClass, formatDateTime } from '../../lib/format';

// One prescription card: shows the medicine, lets the member choose pickup or
// courier delivery, then tracks it through the pharmacy's fulfilment steps.
export default function PrescriptionTracker({ rx, onUpdated }: { rx: Prescription; onUpdated: () => void }) {
  const method = rx.fulfilment_method || '';
  const status = rx.fulfilment_status || 'pending';
  const isDone = status === 'collected' || status === 'delivered';
  // PharmaRun handles fulfilment (nearest outlet + delivery), so we don't show the
  // internal pickup/delivery chooser — just their live status + a tracking link.
  const viaPharmaRun = rx.fulfilment_provider === 'pharmarun';

  const [choice, setChoice] = useState<'pickup' | 'delivery' | ''>(method as 'pickup' | 'delivery' | '');
  const [address, setAddress] = useState(rx.delivery_address || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!choice) { setErr('Choose pickup or delivery.'); return; }
    if (choice === 'delivery' && !address.trim()) { setErr('Add a delivery address.'); return; }
    setSaving(true); setErr('');
    try {
      await setPrescriptionFulfilment(rx.id, choice, choice === 'delivery' ? address : undefined);
      onUpdated();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setErr(ax.response?.data?.error || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Build the step timeline for the chosen method. Each step is reached once the
  // pharmacy has advanced the prescription far enough.
  const order = ['pending', 'ready', method === 'delivery' ? 'out_for_delivery' : 'collected',
    method === 'delivery' ? 'delivered' : ''].filter(Boolean);
  const stepLabels: Record<string, string> = {
    pending: 'Sent to pharmacy',
    ready: method === 'delivery' ? 'Packed & ready' : 'Ready for collection',
    out_for_delivery: 'Out for delivery',
    collected: 'Collected',
    delivered: 'Delivered',
  };
  const stepTimes: Record<string, string | null | undefined> = {
    pending: rx.created_at,
    ready: rx.ready_at,
    out_for_delivery: rx.dispatched_at,
    collected: rx.completed_at,
    delivered: rx.completed_at,
  };
  // 'dispensed' is a legacy alias for 'ready'.
  const normStatus = status === 'dispensed' ? 'ready' : status;
  const reachedIdx = order.indexOf(normStatus);

  return (
    <div className="m-rx">
      <div className="m-rx-top">
        <div className="m-ci">℞</div>
        <div className="m-ct">
          <b>{rx.medication}</b>
          <small>{rx.dosage}{rx.instructions ? ` · ${rx.instructions}` : ''}</small>
          {rx.pharmacy_partner && <small>Pharmacy: {rx.pharmacy_partner}</small>}
        </div>
        <span className={`badge ${badgeClass(status)}`}>{fulfilmentLabel(status)}</span>
      </div>

      {/* PharmaRun fulfilment: their network handles the outlet + delivery */}
      {viaPharmaRun && (
        <div className="m-rx-pharmarun">
          <small>Fulfilled by PharmaRun{rx.external_status ? ` · ${rx.external_status}` : ''}</small>
          {rx.tracking_url && (
            <a className="m-btn primary m-rx-save" href={rx.tracking_url} target="_blank" rel="noreferrer">🛵 Track delivery</a>
          )}
        </div>
      )}

      {/* Step 1 — member chooses how to receive it (internal pharmacies only) */}
      {!isDone && !viaPharmaRun && (
        <div className="m-rx-choose">
          <div className="m-rx-opts">
            <button
              type="button"
              className={`m-rx-opt ${choice === 'pickup' ? 'on' : ''}`}
              onClick={() => setChoice('pickup')}
            >
              🏪 Pick up
              <small>Collect at the pharmacy</small>
            </button>
            <button
              type="button"
              className={`m-rx-opt ${choice === 'delivery' ? 'on' : ''}`}
              onClick={() => setChoice('delivery')}
            >
              🛵 Deliver
              <small>Courier to your address</small>
            </button>
          </div>
          {choice === 'delivery' && (
            <textarea
              className="m-rx-addr"
              placeholder="Delivery address (street, area, city, landmark)"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          )}
          {err && <p className="m-rx-err">{err}</p>}
          <button className="m-btn primary m-rx-save" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : method ? 'Update preference' : 'Confirm'}
          </button>
        </div>
      )}

      {/* Step 2 — tracking timeline, shown once a method is chosen */}
      {method && (
        <div className="m-rx-track">
          {order.map((s, i) => (
            <div key={s} className={`m-rx-step ${i <= reachedIdx ? 'done' : ''} ${i === reachedIdx ? 'now' : ''}`}>
              <span className="m-rx-dot" />
              <div className="m-rx-step-t">
                <span>{stepLabels[s]}</span>
                {i <= reachedIdx && stepTimes[s] && <small>{formatDateTime(stepTimes[s] || null)}</small>}
              </div>
            </div>
          ))}
          {method === 'delivery' && rx.tracking_ref && (normStatus === 'out_for_delivery' || isDone) && (
            <div className="m-rx-courier">
              🛵 {rx.courier_name || 'Courier'} · Tracking <b>{rx.tracking_ref}</b>
            </div>
          )}
          {method === 'delivery' && rx.delivery_address && (
            <div className="m-rx-deliv-addr">Delivering to: {rx.delivery_address}</div>
          )}
        </div>
      )}
    </div>
  );
}
