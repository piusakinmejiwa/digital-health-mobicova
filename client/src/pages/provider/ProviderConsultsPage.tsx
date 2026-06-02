import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProviderConsultations, getProviderConsultation, acceptConsultation,
  updateConsultation, addPrescription,
} from '../../api/provider';
import { formatDateTime, badgeClass, age } from '../../lib/format';
import './Provider.css';

const STATUS_TABS = [
  { key: 'scheduled', label: 'Queue' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
  { key: '', label: 'All' },
];

export default function ProviderConsultsPage() {
  const [tab, setTab] = useState('scheduled');
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['prov-consults', tab],
    queryFn: () => getProviderConsultations(tab || undefined),
  });

  const counts = Object.fromEntries((data?.counts || []).map((c) => [c.status, c.count]));

  return (
    <div className="prov-page">
      <div className="prov-page-head">
        <h1>Consultations</h1>
        <p className="muted">Accept consults, record your assessment, and issue e-prescriptions.</p>
      </div>

      <div className="prov-tabs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            className={`prov-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key && counts[t.key] ? <span className="prov-tab-count">{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : data && data.consultations.length > 0 ? (
        <div className="prov-list">
          {data.consultations.map((c) => (
            <button key={c.id} className="prov-row" onClick={() => setOpenId(c.id)}>
              <div className="prov-row-main">
                <strong>{c.member_name}</strong>
                <span className="muted small">{c.reason || 'Consultation'}</span>
              </div>
              <div className="prov-row-meta">
                <span className="muted small">{c.org_name}</span>
                <span className="muted small">{formatDateTime(c.scheduled_at || c.created_at)}</span>
                <span className={`badge ${badgeClass(c.status)}`}>{c.status.replace('_', ' ')}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">Nothing here right now.</p>
      )}

      {openId && <ConsultDrawer id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ConsultDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: c, isLoading } = useQuery({
    queryKey: ['prov-consult', id],
    queryFn: () => getProviderConsultation(id),
  });

  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [rx, setRx] = useState({ medication: '', dosage: '', instructions: '', pharmacyPartner: '' });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['prov-consult', id] });
    qc.invalidateQueries({ queryKey: ['prov-consults'] });
  };

  // Seed local fields once the consult loads.
  const dx = diagnosis || c?.diagnosis || '';
  const nt = notes || c?.notes || '';

  const accept = async () => { setBusy(true); try { await acceptConsultation(id); refresh(); } finally { setBusy(false); } };
  const save = async (status?: string) => {
    setBusy(true);
    try {
      await updateConsultation(id, { diagnosis: dx, notes: nt, ...(status ? { status } : {}) });
      refresh();
    } finally { setBusy(false); }
  };
  const prescribe = async () => {
    if (!rx.medication.trim()) return;
    setBusy(true);
    try {
      await addPrescription(id, rx);
      setRx({ medication: '', dosage: '', instructions: '', pharmacyPartner: '' });
      refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="prov-drawer-backdrop" onClick={onClose}>
      <div className="prov-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="prov-drawer-close" onClick={onClose}>×</button>
        {isLoading || !c ? (
          <p className="muted">Loading…</p>
        ) : (
          <>
            <div className="prov-drawer-head">
              <h2>{c.member_name}</h2>
              <span className={`badge ${badgeClass(c.status)}`}>{c.status.replace('_', ' ')}</span>
            </div>
            <p className="muted small">
              {c.gender || '—'} · {age(c.date_of_birth)} · {c.org_name} · {c.mode} consult
            </p>

            <div className="prov-clinical">
              <div><span className="prov-label">Reason</span>{c.reason || '—'}</div>
              <div><span className="prov-label">Allergies</span>{c.allergies?.length ? c.allergies.join(', ') : 'None recorded'}</div>
              <div><span className="prov-label">Chronic conditions</span>{c.chronic_conditions?.length ? c.chronic_conditions.join(', ') : 'None recorded'}</div>
            </div>

            {c.status === 'scheduled' ? (
              <button className="btn btn-primary btn-block" onClick={accept} disabled={busy}>
                {busy ? 'Accepting…' : 'Accept consultation'}
              </button>
            ) : (
              <>
                <div className="form-group">
                  <label>Diagnosis</label>
                  <input value={dx} onChange={(e) => setDiagnosis(e.target.value)} disabled={c.status === 'completed'} />
                </div>
                <div className="form-group">
                  <label>Clinical notes</label>
                  <textarea rows={3} value={nt} onChange={(e) => setNotes(e.target.value)} disabled={c.status === 'completed'} />
                </div>

                {c.status !== 'completed' && (
                  <div className="prov-drawer-actions">
                    <button className="btn btn-secondary" onClick={() => save()} disabled={busy}>Save</button>
                    <button className="btn btn-primary" onClick={() => save('completed')} disabled={busy}>Complete consult</button>
                  </div>
                )}

                {/* e-Prescriptions */}
                <div className="prov-section">
                  <h3>e-Prescriptions</h3>
                  {c.prescriptions && c.prescriptions.length > 0 ? (
                    <div className="prov-rx-list">
                      {c.prescriptions.map((p) => (
                        <div key={p.id} className="prov-rx">
                          <div><strong>{p.medication}</strong> <span className="muted small">{p.dosage}</span></div>
                          <div className="muted small">{p.instructions}</div>
                          <div className="prov-rx-foot">
                            <span className="muted small">{p.pharmacy_partner}</span>
                            <span className={`badge ${badgeClass(p.fulfilment_status)}`}>{p.fulfilment_status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted small">No prescriptions issued yet.</p>
                  )}

                  {c.status !== 'completed' && (
                    <div className="prov-rx-form">
                      <input placeholder="Medication (e.g. Amoxicillin 500mg)" value={rx.medication} onChange={(e) => setRx({ ...rx, medication: e.target.value })} />
                      <div className="form-row">
                        <input placeholder="Dosage (e.g. 1 tab 3×/day)" value={rx.dosage} onChange={(e) => setRx({ ...rx, dosage: e.target.value })} />
                        <input placeholder="Pharmacy (optional)" value={rx.pharmacyPartner} onChange={(e) => setRx({ ...rx, pharmacyPartner: e.target.value })} />
                      </div>
                      <input placeholder="Instructions" value={rx.instructions} onChange={(e) => setRx({ ...rx, instructions: e.target.value })} />
                      <button className="btn btn-primary" onClick={prescribe} disabled={busy || !rx.medication.trim()}>Add prescription</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
