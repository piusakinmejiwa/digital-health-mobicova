import { useEffect, useState } from 'react';

// Lightweight cookie notice. The site uses only essential, functional storage (no
// tracking) — so this is a transparency notice with an acknowledgement, not a
// tracking-consent gate. Shows once until the visitor clicks "Got it".
const ACK_KEY = 'mc_cookie_ack';

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(ACK_KEY) !== '1') setShow(true);
    } catch {
      /* storage unavailable — don't nag */
    }
  }, []);

  function accept() {
    try { localStorage.setItem(ACK_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div role="dialog" aria-label="Cookie notice" style={{
      position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 9000,
      maxWidth: 720, margin: '0 auto', background: '#0E2A2A', color: '#eaf4f4',
      borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.28)', padding: '14px 16px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, lineHeight: 1.5,
    }}>
      <span style={{ flex: '1 1 280px', fontSize: 14 }}>
        🍪 We use only <strong>essential cookies</strong> to make MobiCova work (login, language) —
        no advertising or tracking. <a href="/cookies" style={{ color: '#7fdede', textDecoration: 'underline' }}>Learn more</a>.
      </span>
      <button
        onClick={accept}
        style={{
          background: '#139b9b', color: '#fff', border: 0, borderRadius: 8,
          padding: '9px 18px', fontWeight: 600, cursor: 'pointer', flex: '0 0 auto',
        }}
      >
        Got it
      </button>
    </div>
  );
}
