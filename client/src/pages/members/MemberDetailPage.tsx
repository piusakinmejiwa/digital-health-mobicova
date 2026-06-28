import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMember, listPlans, bookConsultation, enrolMember, checkoutPremium, updateMember,
} from '../../api/resources';
import { naira, formatDate, formatDateTime, age, triageLabel, badgeClass } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import MemberEditModal from './MemberEditModal';
import './Members.css';

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id], queryFn: () => getMember(id!), enabled: !!id,
  });
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: listPlans });

  const [reason, setReason] = useState('');
  const [mode, setMode] = useState('video');
  const [planId, setPlanId] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [loc, setLoc] = useState({ address: '', city: '' });
  const [locBusy, setLocBusy] = useState(false);
  const [locSaved, setLocSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (member) setLoc({ address: (member as { address?: string }).address || '', city: (member as { city?: string }).city || '' });
  }, [member]);
  // Deep-link: the members list "Edit" action navigates with ?edit=1.
  useEffect(() => {
    if (canWrite && searchParams.get('edit') === '1') {
      setEditing(true);
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [canWrite, searchParams, setSearchParams]);

  if (isLoading || !member) {
    return <div className="page"><p className="muted">Loading member…</p></div>;
  }

  const saveLocation = async () => {
    setLocBusy(true); setLocSaved(false);
    try {
      await updateMember(member.id, { address: loc.address, city: loc.city });
      setLocSaved(true);
      queryClient.invalidateQueries({ queryKey: ['member', id] });
    } finally { setLocBusy(false); }
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['member', id] });

  const handleBook = async () => {
    setBusy('book');
    try {
      await bookConsultation({ memberId: member.id, mode, reason });
      setReason('');
      refresh();
    } finally { setBusy(''); }
  };

  const handleEnrol = async () => {
    if (!planId) return;
    setBusy('enrol');
    try {
      await enrolMember({ memberId: member.id, planId });
      setPlanId('');
      refresh();
    } finally { setBusy(''); }
  };

  const handlePay = async (enrolmentId: string) => {
    setBusy(enrolmentId);
    setNotice('');
    try {
      const res = await checkoutPremium(enrolmentId);
      if (res.url) {
        window.location.href = res.url;
      } else {
        setNotice(res.message || 'Premium marked paid (demo mode).');
        refresh();
      }
    } finally { setBusy(''); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/members" className="back-link">← Members</Link>
          <h1>{member.full_name}</h1>
          <p>
            {!member.phiRestricted && <>{age(member.date_of_birth)} · {member.gender || 'n/a'} · </>}
            <span className={`badge ${badgeClass(member.status)}`}>{member.status}</span>{' '}
            <span className="badge badge-teal">{member.channel}</span>
          </p>
        </div>
        <div className="page-header-actions">
          {canWrite && (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>
              ✎ Edit member
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate('/assistant', { state: { memberId: member.id, memberName: member.full_name } })}>
            ✦ Triage with AI assistant
          </button>
        </div>
      </div>

      {editing && (
        <MemberEditModal
          member={member}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); refresh(); }}
        />
      )}

      <div className="detail-grid">
        <div className="detail-main">
          {/* Consultations */}
          <div className="card">
            <div className="card-pad card-title-row">
              <h3 className="card-title">Telemedicine consultations</h3>
            </div>
            {member.consultations.length === 0 ? (
              <p className="empty-state small">No consultations yet.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Reason</th><th>Mode</th><th>Doctor</th><th>Provider</th><th>Status</th><th>When</th></tr></thead>
                <tbody>
                  {member.consultations.map((c) => (
                    <tr key={c.id}>
                      <td>{c.reason || <span className="muted">—</span>}</td>
                      <td className="muted">{c.mode}</td>
                      <td>{c.doctor_name}</td>
                      <td className="muted small">{c.partner_name}</td>
                      <td><span className={`badge ${badgeClass(c.status)}`}>{c.status}</span></td>
                      <td className="muted small">{formatDateTime(c.scheduled_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {canWrite && (
              <div className="inline-action">
                <input placeholder="Reason for consultation" value={reason} onChange={(e) => setReason(e.target.value)} />
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="video">Video</option>
                  <option value="voice">Voice</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleBook} disabled={busy === 'book'}>
                  {busy === 'book' ? 'Booking…' : 'Book consultation'}
                </button>
              </div>
            )}
          </div>

          {/* Enrolments */}
          <div className="card">
            <div className="card-pad card-title-row">
              <h3 className="card-title">Insurance enrolments</h3>
            </div>
            {member.enrolments.length === 0 ? (
              <p className="empty-state small">Not enrolled in any plan.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Plan</th><th>Underwriter</th><th>Premium</th><th>Payment</th><th></th></tr></thead>
                <tbody>
                  {member.enrolments.map((e) => (
                    <tr key={e.id}>
                      <td>{e.plan_name}</td>
                      <td className="muted small">{e.underwriter}</td>
                      <td>{naira(e.monthly_premium, e.currency)}/mo</td>
                      <td><span className={`badge ${badgeClass(e.payment_status)}`}>{e.payment_status}</span></td>
                      <td>
                        {canWrite && e.payment_status !== 'paid' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handlePay(e.id)} disabled={busy === e.id}>
                            {busy === e.id ? '…' : 'Collect premium'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {notice && <p className="muted small" style={{ margin: '0.75rem 1rem 0' }}>{notice}</p>}
            {canWrite && (
              <div className="inline-action">
                <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                  <option value="">Select a plan…</option>
                  {plans?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {naira(p.monthly_premium, p.currency)}/mo</option>
                  ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={handleEnrol} disabled={!planId || busy === 'enrol'}>
                  {busy === 'enrol' ? 'Enrolling…' : 'Enrol member'}
                </button>
              </div>
            )}
          </div>

          {/* Prescriptions */}
          {member.prescriptions.length > 0 && (
            <div className="card">
              <div className="card-pad card-title-row"><h3 className="card-title">e-Prescriptions</h3></div>
              <table className="table">
                <thead><tr><th>Medication</th><th>Dosage</th><th>Pharmacy</th><th>Status</th></tr></thead>
                <tbody>
                  {member.prescriptions.map((p) => (
                    <tr key={p.id}>
                      <td>{p.medication}</td>
                      <td className="muted">{p.dosage}</td>
                      <td className="muted small">{p.pharmacy_partner}</td>
                      <td><span className={`badge ${badgeClass(p.fulfilment_status)}`}>{p.fulfilment_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Triage history */}
          <div className="card">
            <div className="card-pad card-title-row"><h3 className="card-title">AI triage history</h3></div>
            {member.triageSessions.length === 0 ? (
              <p className="empty-state small">No triage sessions yet.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Outcome</th><th>Recommendation</th><th>Engine</th><th>When</th></tr></thead>
                <tbody>
                  {member.triageSessions.map((t) => (
                    <tr key={t.id}>
                      <td><span className={`badge triage-${t.triage_level}`}>{triageLabel(t.triage_level)}</span></td>
                      <td className="small">{t.recommendation || <span className="muted">—</span>}</td>
                      <td className="muted small">
                        {t.engine === 'claude'
                          ? <span className="ai-tag" title="Assessed using AI (Claude)">✨ AI</span>
                          : t.engine}
                      </td>
                      <td className="muted small">{formatDateTime(t.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Health profile sidebar */}
        <aside className="detail-aside">
          <div className="card card-pad">
            <h3 className="card-title">Health profile</h3>
            {member.phiRestricted ? (
              <p className="muted small" style={{ margin: 0 }}>
                Clinical details — date of birth, contact details and conditions — are
                not visible to your organisation type. Members manage these in their
                own app; your medical partner can access them when delivering care.
              </p>
            ) : (
              <>
                <dl className="profile-list">
                  <ProfileItem label="Date of birth" value={formatDate(member.date_of_birth)} />
                  <ProfileItem label="Blood group" value={member.blood_group || '—'} />
                  <ProfileItem label="Phone" value={member.phone || '—'} />
                  <ProfileItem label="Email" value={member.email || '—'} />
                </dl>
                <ProfileTags label="Allergies" items={member.allergies} empty="None recorded" />
                <ProfileTags label="Chronic conditions" items={member.chronic_conditions} empty="None recorded" />
                <ProfileTags label="Current medications" items={member.current_medications} empty="None recorded" />
              </>
            )}
          </div>

          {canWrite && (
            <div className="card card-pad">
              <h3 className="card-title">Location</h3>
              <p className="muted small" style={{ marginTop: 0 }}>Routes e-prescriptions to the nearest pharmacy.</p>
              <div className="form-group">
                <label>Address</label>
                <input value={loc.address} onChange={(e) => { setLoc({ ...loc, address: e.target.value }); setLocSaved(false); }} placeholder="e.g. 12 Awolowo Rd, Ikoyi" />
              </div>
              <div className="form-group">
                <label>City / town</label>
                <input value={loc.city} onChange={(e) => { setLoc({ ...loc, city: e.target.value }); setLocSaved(false); }} placeholder="e.g. Lagos" />
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveLocation} disabled={locBusy}>
                {locBusy ? 'Saving…' : locSaved ? 'Saved ✓' : 'Save location'}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="profile-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProfileTags({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <div className="profile-tags">
      <span className="profile-tags-label">{label}</span>
      {items.length === 0 ? (
        <span className="muted small">{empty}</span>
      ) : (
        <div className="tag-list">{items.map((i) => <span key={i} className="tag">{i}</span>)}</div>
      )}
    </div>
  );
}
