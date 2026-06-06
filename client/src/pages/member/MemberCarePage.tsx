import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CallScreen, { type CallProvider } from '../../components/member/CallScreen';
import { logMemberConsultation, getMemberDoctors } from '../../api/member';
import './Member.css';
import './Call.css';

const initials = (n: string) => n.replace(/^Dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('');

export default function MemberCarePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['member-doctors'], queryFn: getMemberDoctors });
  const doctors = data?.doctors ?? [];
  const [call, setCall] = useState<{ mode: 'video' | 'voice'; provider: CallProvider } | null>(null);

  // When a call ends, log it as a consultation (shows in Recent care + the partner dashboard).
  const endCall = (seconds: number) => {
    if (call) {
      logMemberConsultation({ mode: call.mode, doctorName: call.provider.name, durationSeconds: seconds })
        .then(() => {
          qc.invalidateQueries({ queryKey: ['member-overview'] });
          qc.invalidateQueries({ queryKey: ['member-me'] });
        })
        .catch(() => { /* best-effort; don't block the UI */ });
    }
    setCall(null);
  };

  return (
    <div className="m-screen">
      <header className="m-head-plain"><h1>Care</h1></header>
      <div className="m-body">
        {/* Talk to a doctor now — live video / voice */}
        <div className="m-sec-h">Talk to a doctor now</div>
        {doctors.map((d) => {
          const provider: CallProvider = { name: d.full_name, role: d.specialty || 'Doctor', photo: d.photo_url || undefined };
          return (
            <div key={d.id} className="m-doc">
              <div className="m-doc-top">
                {d.photo_url
                  ? <img className="m-doc-av" src={d.photo_url} alt={d.full_name} />
                  : <div className="m-doc-av m-doc-av-ph">{initials(d.full_name)}</div>}
                <div className="m-doc-info">
                  <b>{d.full_name}</b>
                  <small>{d.specialty || 'General Practice'}</small>
                  <span className="m-doc-status on">● Available now</span>
                </div>
              </div>
              <div className="m-doc-actions">
                <button className="m-doc-btn video" onClick={() => setCall({ mode: 'video', provider })}>📹 Video call</button>
                <button className="m-doc-btn voice" onClick={() => setCall({ mode: 'voice', provider })}>📞 Voice call</button>
              </div>
            </div>
          );
        })}
        {doctors.length === 0 && <p className="m-muted">No doctors are available right now — please check back shortly.</p>}
        <p className="m-muted">Connect instantly with a licensed doctor — consultations are delivered through MobiCova’s provider partners.</p>

        {/* AI symptom check */}
        <div className="m-sec-h">Not sure? Check a symptom first</div>
        <div className="m-act-wide" onClick={() => navigate('/member/care/symptom-check')}>
          <div className="m-ai amber">✦</div>
          <div>
            <div className="m-al">AI symptom check</div>
            <div className="m-as">Free guidance in seconds — not a diagnosis</div>
          </div>
        </div>
      </div>

      {call && (
        <CallScreen mode={call.mode} provider={call.provider} onEnd={endCall} />
      )}
    </div>
  );
}
