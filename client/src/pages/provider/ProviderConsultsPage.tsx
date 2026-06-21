import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getProviderConsultations, getProviderConsultation, acceptConsultation,
  updateConsultation, addPrescription, getPharmacies, getConsultationCallToken, getConsultationRecording,
  getIncomingCalls,
} from '../../api/provider';
import { formatDateTime, badgeClass, age } from '../../lib/format';
import CallScreen from '../../components/member/CallScreen';
import VideoCall from '../../components/member/VideoCall';
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
  const [autoJoinId, setAutoJoinId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['prov-consults', tab],
    queryFn: () => getProviderConsultations(tab || undefined),
    refetchInterval: 10000, // keep the queue fresh so waiting calls appear
  });
  // Poll for members waiting in a live call — drives the incoming-call banner.
  const { data: incomingData } = useQuery({
    queryKey: ['prov-incoming'],
    queryFn: getIncomingCalls,
    refetchInterval: 5000,
  });
  const incoming = incomingData?.calls ?? [];

  const counts = Object.fromEntries((data?.counts || []).map((c) => [c.status, c.count]));

  // Open a waiting consult and auto-join its call in one click.
  const answer = (id: string) => { setAutoJoinId(id); setOpenId(id); };

  return (
    <div className="prov-page">
      <div className="prov-page-head">
        <h1>Consultations</h1>
        <p className="muted">Accept consults, record your assessment, and issue e-prescriptions.</p>
      </div>

      {incoming.length > 0 && (
        <div className="prov-incoming">
          {incoming.map((call) => (
            <div key={call.id} className="prov-incoming-row">
              <span className="prov-incoming-dot" />
              <span className="prov-incoming-txt">
                <strong>{call.member_name}</strong> is waiting in a {call.mode} call
              </span>
              <button className="btn btn-primary btn-sm" onClick={() => answer(call.id)}>
                {call.mode === 'voice' ? '📞' : '📹'} Answer now
              </button>
            </div>
          ))}
        </div>
      )}

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

      {openId && (
        <ConsultDrawer
          id={openId}
          autoJoin={openId === autoJoinId}
          onClose={() => { setOpenId(null); setAutoJoinId(null); }}
        />
      )}
    </div>
  );
}

function ConsultDrawer({ id, autoJoin, onClose }: { id: string; autoJoin?: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: c, isLoading } = useQuery({
    queryKey: ['prov-consult', id],
    queryFn: () => getProviderConsultation(id),
  });

  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [rx, setRx] = useState({ medication: '', dosage: '', instructions: '', pharmacyPartnerId: '' });
  const [call, setCall] = useState<'video' | 'voice' | null>(null);
  const [videoCall, setVideoCall] = useState<{ roomUrl: string; token: string; recording?: boolean } | null>(null);
  const [rec, setRec] = useState<{ loading?: boolean; available?: boolean; link?: string | null; error?: string } | null>(null);
  const fetchRecording = async () => {
    setRec({ loading: true });
    try { setRec(await getConsultationRecording(id)); }
    catch { setRec({ error: 'Could not fetch the recording.' }); }
  };
  const { data: pharmaciesData } = useQuery({ queryKey: ['provider-pharmacies', id], queryFn: () => getPharmacies(id) });
  const pharmacies = pharmaciesData?.pharmacies ?? [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['prov-consult', id] });
    qc.invalidateQueries({ queryKey: ['prov-consults'] });
  };

  // Seed local fields once the consult loads.
  const dx = diagnosis || c?.diagnosis || '';
  const nt = notes || c?.notes || '';

  const accept = async () => { setBusy(true); try { await acceptConsultation(id); refresh(); } finally { setBusy(false); } };
  // Join the live Daily room (video or voice); fall back to the demo screen if
  // Daily isn't set up. The server picks camera-on/off from the consult's mode.
  const joinCall = async (mode: 'video' | 'voice') => {
    try { const r = await getConsultationCallToken(id); setVideoCall({ roomUrl: r.roomUrl, token: r.token, recording: r.recording }); }
    catch { setCall(mode); }
  };

  // When opened from the incoming-call badge, join straight away (once the consult loads).
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoin && c && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      joinCall(c.mode === 'voice' ? 'voice' : 'video');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, c]);
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
      setRx({ medication: '', dosage: '', instructions: '', pharmacyPartnerId: '' });
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
              <div>
                <span className="prov-label">Recording</span>
                {(c as { recording_consent?: boolean }).recording_consent ? (
                  <>
                    Patient consented ·{' '}
                    <a style={{ cursor: 'pointer', color: '#0a7b7b' }} onClick={fetchRecording}>
                      {rec?.loading ? 'Fetching…' : 'Get recording link'}
                    </a>
                    {rec?.link && <> · <a href={rec.link} target="_blank" rel="noreferrer">Download</a></>}
                    {rec?.available === false && <span className="muted small"> · not ready yet</span>}
                    {rec?.error && <span className="muted small"> · {rec.error}</span>}
                  </>
                ) : 'Not recorded (no consent)'}
              </div>
            </div>

            {c.status !== 'completed' && (
              <div className="prov-callbar">
                <button className="btn btn-primary" onClick={() => joinCall('video')}>📹 Join video call</button>
                <button className="btn btn-secondary" onClick={() => joinCall('voice')}>📞 Voice call</button>
              </div>
            )}

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
                        <select
                          value={rx.pharmacyPartnerId || pharmacies[0]?.id || ''}
                          onChange={(e) => setRx({ ...rx, pharmacyPartnerId: e.target.value })}
                          title="Fulfilling pharmacy"
                        >
                          {pharmacies.length === 0 && <option value="">No pharmacies available</option>}
                          {pharmacies.map((ph, i) => (
                            <option key={ph.id} value={ph.id}>
                              {ph.name}{ph.distanceKm != null ? ` · ${ph.distanceKm} km${i === 0 ? ' (nearest)' : ''}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input placeholder="Instructions" value={rx.instructions} onChange={(e) => setRx({ ...rx, instructions: e.target.value })} />
                      <button className="btn btn-primary" onClick={prescribe} disabled={busy || !rx.medication.trim()}>Add prescription</button>
                    </div>
                  )}
                </div>
              </>
            )}

            {call && (
              <CallScreen
                mode={call}
                provider={{ name: c.member_name, role: 'Patient' }}
                endNote="add your notes and complete the consult"
                onEnd={() => setCall(null)}
              />
            )}
            {videoCall && (
              <VideoCall
                roomUrl={videoCall.roomUrl}
                token={videoCall.token}
                title={c.member_name}
                subtitle="Patient · MobiCova Telemedicine"
                recording={videoCall.recording}
                onEnd={() => setVideoCall(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
