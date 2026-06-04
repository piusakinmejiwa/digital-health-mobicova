import { useNavigate } from 'react-router-dom';
import './Member.css';

export default function MemberCarePage() {
  const navigate = useNavigate();

  return (
    <div className="m-screen">
      <header className="m-head-plain"><h1>Care</h1></header>
      <div className="m-body">
        {/* AI symptom check — the interactive entry point */}
        <div className="m-sec-h">Check a symptom first</div>
        <div className="m-act-wide" onClick={() => navigate('/member/care/symptom-check')}>
          <div className="m-ai amber">✦</div>
          <div>
            <div className="m-al">AI symptom check</div>
            <div className="m-as">Free guidance in seconds — not a diagnosis</div>
          </div>
        </div>

        {/* Talk to a doctor */}
        <div className="m-sec-h">Talk to a doctor</div>
        <div className="m-list-card">
          <div className="m-ci" style={{ background: '#d6efef', color: '#066' }}>✚</div>
          <div className="m-ct">
            <b>Request a consultation</b>
            <small>Video, voice or chat with a licensed doctor</small>
          </div>
        </div>
        <p className="m-muted">
          Consultations are arranged through your provider organisation. Start a symptom check above and
          we’ll guide you to the right care.
        </p>

        <div className="m-flabel">Consultation modes</div>
        <div className="m-chips">
          <span className="m-chip on">Video</span>
          <span className="m-chip">Voice</span>
          <span className="m-chip">Chat</span>
        </div>
      </div>
    </div>
  );
}
