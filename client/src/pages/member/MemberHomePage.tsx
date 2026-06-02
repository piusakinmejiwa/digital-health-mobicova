import { useQuery } from '@tanstack/react-query';
import { getMemberMe, getMemberOverview } from '../../api/member';
import { naira, formatDate, formatDateTime, badgeClass, triageLabel } from '../../lib/format';
import './Member.css';

export default function MemberHomePage() {
  const { data: me } = useQuery({ queryKey: ['member-me'], queryFn: getMemberMe });
  const { data: overview, isLoading } = useQuery({ queryKey: ['member-overview'], queryFn: getMemberOverview });

  return (
    <div className="member-page">
      {/* Profile header */}
      <section className="member-hero">
        <div>
          <h1>{me?.full_name || 'Your health profile'}</h1>
          <p className="muted">{me?.org_name ? `Covered through ${me.org_name}` : ''}</p>
        </div>
        <div className="member-hero-stats">
          <div className="member-stat"><strong>{me?.counts.enrolments ?? '—'}</strong><span>Cover</span></div>
          <div className="member-stat"><strong>{me?.counts.consultations ?? '—'}</strong><span>Consults</span></div>
          <div className="member-stat"><strong>{me?.counts.claims ?? '—'}</strong><span>Claims</span></div>
        </div>
      </section>

      {/* Health snapshot */}
      {me && (
        <section className="member-card">
          <h2>Health snapshot</h2>
          <div className="member-grid">
            <div><span className="member-label">Phone</span>{me.phone || '—'}</div>
            <div><span className="member-label">Email</span>{me.email || '—'}</div>
            <div><span className="member-label">Blood group</span>{me.blood_group || '—'}</div>
            <div><span className="member-label">Allergies</span>{me.allergies?.length ? me.allergies.join(', ') : '—'}</div>
            <div><span className="member-label">Chronic conditions</span>{me.chronic_conditions?.length ? me.chronic_conditions.join(', ') : '—'}</div>
            <div><span className="member-label">Medications</span>{me.current_medications?.length ? me.current_medications.join(', ') : '—'}</div>
          </div>
        </section>
      )}

      {isLoading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {/* Cover / enrolments */}
          <section className="member-card">
            <h2>My cover</h2>
            {overview?.enrolments.length ? (
              <div className="member-list">
                {overview.enrolments.map((e) => (
                  <div key={e.id} className="member-row">
                    <div>
                      <strong>{e.plan_name}</strong>
                      <span className="muted small"> · {e.underwriter}</span>
                    </div>
                    <div className="member-row-meta">
                      <span>{naira(e.monthly_premium, e.currency)}/mo</span>
                      <span className={`badge ${badgeClass(e.payment_status)}`}>{e.payment_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">You don’t have any active cover yet. Your provider can enrol you in a plan.</p>
            )}
          </section>

          {/* Care / consultations */}
          <section className="member-card">
            <h2>Recent care</h2>
            {overview?.consultations.length ? (
              <div className="member-list">
                {overview.consultations.slice(0, 6).map((c) => (
                  <div key={c.id} className="member-row">
                    <div>
                      <strong>{c.reason || 'Consultation'}</strong>
                      <span className="muted small"> · {c.partner_name || c.mode}</span>
                    </div>
                    <div className="member-row-meta">
                      <span>{formatDateTime(c.scheduled_at || c.created_at)}</span>
                      <span className={`badge ${badgeClass(c.status)}`}>{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No consultations on record yet.</p>
            )}
          </section>

          {/* Prescriptions */}
          {overview?.prescriptions.length ? (
            <section className="member-card">
              <h2>Prescriptions</h2>
              <div className="member-list">
                {overview.prescriptions.slice(0, 6).map((p) => (
                  <div key={p.id} className="member-row">
                    <div>
                      <strong>{p.medication}</strong>
                      <span className="muted small"> · {p.dosage}</span>
                    </div>
                    <div className="member-row-meta">
                      <span className="muted small">{p.pharmacy_partner || '—'}</span>
                      <span className={`badge ${badgeClass(p.fulfilment_status)}`}>{p.fulfilment_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Triage history */}
          {overview?.triageSessions.length ? (
            <section className="member-card">
              <h2>AI health checks</h2>
              <div className="member-list">
                {overview.triageSessions.slice(0, 5).map((t) => (
                  <div key={t.id} className="member-row">
                    <div><strong>{triageLabel(t.triage_level)}</strong></div>
                    <div className="member-row-meta">
                      <span className="muted small">{formatDate(t.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
