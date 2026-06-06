import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMemberMe, getMemberOverview } from '../../api/member';
import { naira, formatDate, badgeClass } from '../../lib/format';
import './Member.css';

export default function MemberHomePage() {
  const navigate = useNavigate();
  const { data: me } = useQuery({ queryKey: ['member-me'], queryFn: getMemberMe });
  const { data: overview } = useQuery({ queryKey: ['member-overview'], queryFn: getMemberOverview });

  const cover = overview?.enrolments[0];
  const firstName = me?.full_name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="m-screen">
      {/* Branded header */}
      <header className="m-head-brand">
        <div className="m-head-row">
          <div className="m-greet">
            <small>{greeting}</small>
            <b>{me?.full_name || 'Welcome'}</b>
          </div>
          <div className="m-av">{firstName.charAt(0)}</div>
        </div>
      </header>

      <div className="m-body">
        {/* Cover card */}
        {cover ? (
          <div className="m-cover">
            <div className="m-cover-lab">Your cover</div>
            <div className="m-cover-pl">{cover.plan_name}</div>
            <div className="m-cover-meta">
              <span>Premium {naira(cover.monthly_premium, cover.currency)} / mo</span>
              <span className="m-cover-st">● {cover.payment_status === 'paid' ? 'Active · Paid' : cover.status}</span>
            </div>
          </div>
        ) : (
          <div className="m-cover m-cover-empty">
            <div className="m-cover-lab">Your cover</div>
            <div className="m-cover-pl">No active cover yet</div>
            <div className="m-cover-meta"><span>Your provider can enrol you in a plan.</span></div>
          </div>
        )}

        {/* Stat tiles */}
        <div className="m-stat2">
          <div className="m-statc">
            <div className="m-statc-v">{me?.counts.consultations ?? 0}</div>
            <div className="m-statc-l">Consultations</div>
          </div>
          <div className="m-statc">
            <div className="m-statc-v">{me?.counts.claims ?? 0}</div>
            <div className="m-statc-l">Claims</div>
          </div>
        </div>

        <div className="m-actions2 m-mt">
          <button className="m-btn primary" onClick={() => navigate('/member/care')}>
            📹 Talk to a doctor
          </button>
          <button className="m-btn ghost" onClick={() => navigate('/member/claims')}>
            ＋ Submit a claim
          </button>
        </div>

        {/* Recent care */}
        <div className="m-sec-h">Recent care</div>
        {overview && (overview.consultations.length > 0 || overview.prescriptions.length > 0) ? (
          <>
            {overview.consultations.slice(0, 3).map((c) => (
              <div key={c.id} className="m-list-card">
                <div className="m-ci">✚</div>
                <div className="m-ct">
                  <b>{c.reason || 'Consultation'}</b>
                  <small>{formatDate(c.scheduled_at || c.created_at)} · {c.mode}</small>
                </div>
                <span className={`badge ${badgeClass(c.status)}`}>{c.status}</span>
              </div>
            ))}
            {overview.prescriptions.slice(0, 2).map((p) => (
              <div key={p.id} className="m-list-card">
                <div className="m-ci">℞</div>
                <div className="m-ct">
                  <b>{p.medication}</b>
                  <small>Prescribed · {p.fulfilment_status}</small>
                </div>
                <span className={`badge ${badgeClass(p.fulfilment_status)}`}>{p.fulfilment_status}</span>
              </div>
            ))}
          </>
        ) : (
          <p className="m-muted">No care on record yet. Start a symptom check or talk to a doctor under Care.</p>
        )}
      </div>
    </div>
  );
}
