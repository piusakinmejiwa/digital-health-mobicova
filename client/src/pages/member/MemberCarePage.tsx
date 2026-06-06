import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import CallScreen, { type CallProvider } from '../../components/member/CallScreen';
import { logMemberConsultation } from '../../api/member';
import './Member.css';
import './Call.css';

type Doctor = CallProvider & { status: string; now: boolean };

const DOCTORS: Doctor[] = [
  { name: 'Dr. Adaeze Okonkwo', role: 'General Practice', photo: '/images/doctor.jpg', status: 'Available now', now: true },
  { name: 'Dr. Ibrahim Musa', role: 'Family Medicine', status: 'Available now', now: true },
  { name: 'Dr. Folake Adeyemi', role: 'Paediatrics', status: 'Available in ~5 min', now: false },
];

const initials = (n: string) => n.replace(/^Dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('');

export default function MemberCarePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
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
        {DOCTORS.map((d) => (
          <div key={d.name} className="m-doc">
            <div className="m-doc-top">
              {d.photo
                ? <img className="m-doc-av" src={d.photo} alt={d.name} />
                : <div className="m-doc-av m-doc-av-ph">{initials(d.name)}</div>}
              <div className="m-doc-info">
                <b>{d.name}</b>
                <small>{d.role}</small>
                <span className={`m-doc-status ${d.now ? 'on' : ''}`}>● {d.status}</span>
              </div>
            </div>
            <div className="m-doc-actions">
              <button className="m-doc-btn video" disabled={!d.now} onClick={() => setCall({ mode: 'video', provider: d })}>
                📹 Video call
              </button>
              <button className="m-doc-btn voice" disabled={!d.now} onClick={() => setCall({ mode: 'voice', provider: d })}>
                📞 Voice call
              </button>
            </div>
          </div>
        ))}
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
