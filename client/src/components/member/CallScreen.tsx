import { useEffect, useRef, useState } from 'react';
import '../../pages/member/Call.css';

export interface CallProvider {
  name: string;
  role: string;
  photo?: string;
}

type Phase = 'connecting' | 'connected' | 'ended';

// A polished, self-contained telemedicine call experience for demos: connecting →
// connected (with a live call timer and mute / camera / end controls), using the
// device camera for the self-view. No signalling server needed — the remote
// "doctor" tile is the provider's photo/avatar. Falls back gracefully if the
// browser blocks or lacks a camera/mic.
export default function CallScreen({
  mode, provider, onEnd,
}: {
  mode: 'video' | 'voice';
  provider: CallProvider;
  onEnd: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('connecting');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [camReady, setCamReady] = useState(false);
  const selfRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  // Acquire camera/mic (camera only matters in video mode for the self-view).
  useEffect(() => {
    let cancelled = false;
    const constraints: MediaStreamConstraints =
      mode === 'video' ? { video: { facingMode: 'user' }, audio: true } : { audio: true };
    navigator.mediaDevices?.getUserMedia(constraints)
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (mode === 'video' && selfRef.current) {
          selfRef.current.srcObject = stream;
          setCamReady(true);
        }
      })
      .catch(() => { /* no camera/mic — the avatar fallback is shown */ });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  // Ring for a moment, then "connect".
  useEffect(() => {
    const t = window.setTimeout(() => setPhase('connected'), 2200);
    return () => window.clearTimeout(t);
  }, []);

  // Run the call timer while connected.
  useEffect(() => {
    if (phase !== 'connected') return;
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timerRef.current);
  }, [phase]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const initials = provider.name.replace(/^Dr\.?\s*/i, '').split(' ').map((w) => w[0]).slice(0, 2).join('');

  const toggleMute = () => {
    const next = !muted; setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
  };
  const toggleCam = () => {
    const next = !camOff; setCamOff(next);
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
  };
  const end = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    window.clearInterval(timerRef.current);
    setPhase('ended');
    window.setTimeout(onEnd, 1700);
  };

  return (
    <div className={`call call-${mode}`}>
      {/* Remote (doctor) tile */}
      <div className="call-remote">
        {mode === 'video' && provider.photo ? (
          <img className="call-remote-vid" src={provider.photo} alt={provider.name} />
        ) : (
          <div className="call-bigavatar">{initials}</div>
        )}
        <div className="call-remote-grad" />
      </div>

      {/* Top bar */}
      <div className="call-top">
        <div className="call-who">
          <b>{provider.name}</b>
          <span>{phase === 'connecting' ? 'Connecting…' : phase === 'ended' ? 'Call ended' : provider.role}</span>
        </div>
        {phase === 'connected' && (
          <div className="call-timer"><span className="call-rec" /> {fmt(seconds)}</div>
        )}
      </div>
      {phase === 'connected' && <div className="call-enc">🔒 End-to-end encrypted</div>}

      {/* Connecting overlay */}
      {phase === 'connecting' && (
        <div className="call-connecting">
          <div className="call-ring"><div className="call-bigavatar lg">{initials}</div></div>
          <div className="call-conn-name">{provider.name}</div>
          <div className="call-conn-sub">{provider.role} · MobiCova Telemedicine</div>
        </div>
      )}

      {/* Self-view (video mode) */}
      {mode === 'video' && phase === 'connected' && (
        <div className={`call-self ${camOff || !camReady ? 'off' : ''}`}>
          <video ref={selfRef} autoPlay playsInline muted />
          {(camOff || !camReady) && <span className="call-self-lbl">{camOff ? 'Camera off' : 'You'}</span>}
        </div>
      )}

      {/* Ended overlay */}
      {phase === 'ended' && (
        <div className="call-ended">
          <div className="call-ended-check">✓</div>
          <div className="call-ended-t">Consultation ended</div>
          <div className="call-ended-s">{fmt(seconds)} · summary added to your records</div>
        </div>
      )}

      {/* Controls */}
      {phase !== 'ended' && (
        <div className="call-controls">
          <button className={`call-ctl ${muted ? 'active' : ''}`} onClick={toggleMute}>
            <span className="call-ico">{muted ? '🔇' : '🎤'}</span>{muted ? 'Unmute' : 'Mute'}
          </button>
          {mode === 'video' && (
            <button className={`call-ctl ${camOff ? 'active' : ''}`} onClick={toggleCam}>
              <span className="call-ico">{camOff ? '📷' : '📹'}</span>{camOff ? 'Start' : 'Stop'}
            </button>
          )}
          <button className="call-ctl end" onClick={end}>
            <span className="call-ico">📞</span>End
          </button>
        </div>
      )}
    </div>
  );
}
