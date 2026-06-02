import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listConsultations, listMembers, listPartners, bookConsultation,
  getConsultation, updateConsultation, addPrescription,
} from '../../api/resources';
import type { Consultation } from '../../types';
import { formatDateTime, badgeClass } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import './Telemedicine.css';

export default function TelemedicinePage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const { data: consultations, isLoading } = useQuery({ queryKey: ['consultations'], queryFn: listConsultations });
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });
  const { data: partners } = useQuery({ queryKey: ['partners'], queryFn: listPartners });

  const telemedPartners = partners?.filter((p) => p.category === 'telemedicine') || [];

  const [memberId, setMemberId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [mode, setMode] = useState('video');
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['consultations'] });

  const handleBook = async () => {
    if (!memberId) return;
    setBooking(true);
    try {
      await bookConsultation({ memberId, partnerId: partnerId || undefined, mode, reason });
      setReason(''); setMemberId(''); setPartnerId('');
      refresh();
    } finally { setBooking(false); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Telemedicine</h1>
          <p>Consultations delivered through MDCN-licensed provider partners.</p>
        </div>
      </div>

      {canWrite && (
      <div className="card card-pad book-bar">
        <h3 className="card-title">Book a consultation</h3>
        <div className="book-row">
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">Select member…</option>
            {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Auto-assign provider</option>
            {telemedPartners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="video">Video</option>
            <option value="voice">Voice</option>
          </select>
          <input placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-primary" onClick={handleBook} disabled={!memberId || booking}>
            {booking ? 'Booking…' : 'Book'}
          </button>
        </div>
      </div>
      )}

      <div className="card">
        {isLoading ? (
          <p className="empty-state">Loading consultations…</p>
        ) : !consultations || consultations.length === 0 ? (
          <p className="empty-state">No consultations booked yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Member</th><th>Reason</th><th>Mode</th><th>Doctor</th><th>Provider</th><th>Status</th><th>When</th><th></th></tr>
            </thead>
            <tbody>
              {consultations.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.member_name}</strong></td>
                  <td>{c.reason || <span className="muted">—</span>}</td>
                  <td className="muted">{c.mode}</td>
                  <td>{c.doctor_name}</td>
                  <td className="muted small">{c.partner_name}</td>
                  <td><span className={`badge ${badgeClass(c.status)}`}>{c.status}</span></td>
                  <td className="muted small">{formatDateTime(c.scheduled_at)}</td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => setSelected(c.id)}>{canWrite ? 'Manage' : 'View'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ConsultationDrawer
          id={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
          onChanged={refresh}
          pharmacies={(partners?.filter((p) => p.category === 'pharmacy') || []).map((p) => p.name)}
        />
      )}
    </div>
  );
}

function ConsultationDrawer({ id, canWrite, onClose, onChanged, pharmacies }: {
  id: string; canWrite: boolean; onClose: () => void; onChanged: () => void; pharmacies: string[];
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['consultation', id], queryFn: () => getConsultation(id) });
  const [notes, setNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [med, setMed] = useState('');
  const [dosage, setDosage] = useState('');
  const [pharmacy, setPharmacy] = useState(pharmacies[0] || '');
  const [busy, setBusy] = useState('');

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['consultation', id] });
    onChanged();
  };

  const save = async (status?: string) => {
    setBusy('save');
    try {
      await updateConsultation(id, {
        status,
        notes: notes || (data as Consultation)?.notes,
        diagnosis: diagnosis || (data as Consultation)?.diagnosis,
      });
      refreshAll();
    } finally { setBusy(''); }
  };

  const prescribe = async () => {
    if (!med) return;
    setBusy('rx');
    try {
      await addPrescription(id, { medication: med, dosage, pharmacyPartner: pharmacy });
      setMed(''); setDosage('');
      refreshAll();
    } finally { setBusy(''); }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Manage consultation</h3>
          <button className="drawer-close" onClick={onClose}>×</button>
        </div>
        {isLoading || !data ? (
          <p className="muted" style={{ padding: '1rem' }}>Loading…</p>
        ) : (
          <div className="drawer-body">
            <div className="drawer-meta">
              <div><span className="muted small">Member</span><strong>{data.member_name}</strong></div>
              <div><span className="muted small">Doctor</span><strong>{data.doctor_name}</strong></div>
              <div><span className="muted small">Status</span><span className={`badge ${badgeClass(data.status)}`}>{data.status}</span></div>
            </div>

            <div className="form-group">
              <label>Consultation notes</label>
              {canWrite
                ? <textarea rows={3} defaultValue={data.notes} onChange={(e) => setNotes(e.target.value)} />
                : <p className="muted">{data.notes || '—'}</p>}
            </div>
            <div className="form-group">
              <label>Diagnosis / impression</label>
              {canWrite
                ? <input defaultValue={data.diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
                : <p className="muted">{data.diagnosis || '—'}</p>}
            </div>
            {canWrite && (
              <div className="drawer-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => save('in_progress')} disabled={busy === 'save'}>Mark in progress</button>
                <button className="btn btn-primary btn-sm" onClick={() => save('completed')} disabled={busy === 'save'}>Save &amp; complete</button>
              </div>
            )}

            <h4 className="drawer-subhead">e-Prescription</h4>
            {data.prescriptions && data.prescriptions.length > 0 ? (
              <ul className="rx-list">
                {data.prescriptions.map((p) => (
                  <li key={p.id}><strong>{p.medication}</strong> {p.dosage} <span className="muted small">· {p.pharmacy_partner}</span></li>
                ))}
              </ul>
            ) : !canWrite && <p className="muted small">No prescriptions on this consultation.</p>}
            {canWrite && (
              <div className="rx-form">
                <input placeholder="Medication" value={med} onChange={(e) => setMed(e.target.value)} />
                <input placeholder="Dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} />
                <select value={pharmacy} onChange={(e) => setPharmacy(e.target.value)}>
                  {pharmacies.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={prescribe} disabled={!med || busy === 'rx'}>Add</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
