import { useEffect, useRef, useState } from 'react';
import '../../pages/member/Call.css';

// A real, two-way video consultation powered by Daily.co. We embed Daily's
// prebuilt call UI by loading the private room URL with a meeting token
// (`?t=…`) in an iframe — no extra SDK needed. Both the member and the doctor
// join the same room, so two browser tabs connect to each other live.
//
// Our own header (timer) + "End call" bar sit above the iframe and own the
// close, so the parent can log the consultation duration.
export default function VideoCall({
  roomUrl, token, title, subtitle, onEnd, recording = false,
}: {
  roomUrl: string;
  token: string;
  title: string;
  subtitle?: string;
  onEnd: (seconds: number) => void;
  recording?: boolean;
}) {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    const t = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - startRef.current) / 1000)),
      1000
    );
    return () => window.clearInterval(t);
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const src = `${roomUrl}${roomUrl.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;

  return (
    <div className="vcall">
      <div className="vcall-top">
        <div className="vcall-who">
          <b>{title}</b>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <div className="vcall-timer"><span className="call-rec" /> {fmt(seconds)}</div>
      </div>
      {recording && (
        <div className="vcall-recbar">🔴 This consultation is being recorded — both parties have been notified.</div>
      )}
      <iframe
        className="vcall-frame"
        title="MobiCova video consultation"
        src={src}
        allow="camera; microphone; autoplay; display-capture; fullscreen; speaker"
      />
      <div className="vcall-controls">
        <button className="vcall-end" onClick={() => onEnd(seconds)}>
          <span className="call-ico">📞</span> End call
        </button>
      </div>
    </div>
  );
}
