import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandLogo from '../../components/common/BrandLogo';
import { chatWithBuddy } from '../../api/buddy';
import type { BuddyMessage, BuddySource } from '../../api/buddy';
import { SPECIALTIES, specialtyByKey } from '../../lib/buddyCatalog';
import SiteFooter from '../../components/marketing/SiteFooter';
import './BuddyPage.css';

type Msg = BuddyMessage & { sources?: BuddySource[]; safety?: 'ok' | 'crisis' | 'emergency' | 'distress' };

export default function BuddyPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  // Land straight in the General Health buddy by default; "← Buddies" reveals the
  // full grid of specialty buddies.
  const [active, setActive] = useState<string | null>('general');
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: specialtyByKey('general').greeting }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);

  const buddy = active ? specialtyByKey(active) : null;

  // Safe Emotions is gated until clinician + legal sign-off (SAFE-EMOTIONS-SAFETY-DESIGN.md).
  // Production sets VITE_SAFE_EMOTIONS_ENABLED=false to hide it until the gate is signed.
  const buddies = SPECIALTIES.filter(
    (s) => s.key !== 'safe_emotions' || import.meta.env.VITE_SAFE_EMOTIONS_ENABLED !== 'false'
  );

  function openBuddy(key: string) {
    setActive(key);
    setMsgs([{ role: 'assistant', content: specialtyByKey(key).greeting }]);
    setInput('');
  }
  function backToBuddies() {
    setActive(null);
    setMsgs([]);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending || !active) return;
    const history = msgs.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setSending(true);
    try {
      const res = await chatWithBuddy([...history, { role: 'user', content: q }], active, i18n.resolvedLanguage);
      setMsgs((m) => [...m, { role: 'assistant', content: res.reply, sources: res.sources, safety: res.safety }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="buddy">
      <header className="buddy-head">
        <div className="buddy-logo" onClick={() => navigate('/')} role="button"><BrandLogo /></div>
        {buddy
          ? <a className="buddy-home" onClick={backToBuddies}>← Buddies</a>
          : <a className="buddy-home" onClick={() => navigate('/')}>← Home</a>}
      </header>

      <div className="buddy-shell">
        {!buddy ? (
          <>
            <div className="buddy-title">
              <h1>Health Buddy</h1>
              <p className="buddy-disclaimer">Pick a buddy for free, general health info from trusted sources — <strong>not a diagnosis</strong>.</p>
            </div>
            <div className="buddy-grid">
              {buddies.map((s) => (
                <button key={s.key} className={`buddy-card ${s.key === 'safe_emotions' ? 'care' : ''}`} onClick={() => openBuddy(s.key)}>
                  <span className="buddy-card-emoji">{s.emoji}</span>
                  <span className="buddy-card-name">{s.name}</span>
                  <span className="buddy-card-blurb">{s.blurb}</span>
                </button>
              ))}
            </div>
            <p className="buddy-foot">If you may be in danger, call <strong>112</strong>. Free tier: 20 questions/day.</p>
          </>
        ) : (
          <>
            <div className="buddy-title">
              <h1><span className="buddy-emoji">{buddy.emoji}</span> {buddy.name}</h1>
              <p className="buddy-disclaimer">General info, <strong>not a diagnosis</strong>. For your own health, see a clinician.</p>
            </div>

            {buddy.key === 'safe_emotions' && (
              <div className="buddy-help-strip">💚 Need to talk now? SURPIN 0800 0787 746 · MANI 0809 111 6264 · Emergency 112</div>
            )}

            <div className="buddy-chat">
              {msgs.map((m, i) => (
                <div key={i} className={`buddy-row ${m.role}`}>
                  {m.role === 'assistant' && (
                    <img src="/apple-touch-icon.png" alt="MobiCova" className="buddy-avatar" />
                  )}
                  <div className={`buddy-bubble ${m.role} ${m.safety === 'crisis' || m.safety === 'emergency' ? 'alert' : ''}`}>
                    {m.content.split('\n').map((line, j) => <p key={j}>{line || ' '}</p>)}
                    {m.sources && m.sources.length > 0 && (
                      <div className="buddy-sources">
                        {m.sources.map((s, k) => (
                          <a key={k} href={s.url} target="_blank" rel="noopener noreferrer" className="buddy-source">{s.name}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && <div className="buddy-row assistant"><div className="buddy-bubble assistant"><span className="buddy-typing">…</span></div></div>}
              <div ref={endRef} />
            </div>

            {msgs.length <= 1 && (
              <div className="buddy-suggestions">
                {buddy.suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            )}

            <form className="buddy-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask the ${buddy.name} buddy…`} maxLength={500} />
              <button type="submit" disabled={sending || !input.trim()}>Send</button>
            </form>
            <p className="buddy-foot">If you may be in danger, call <strong>112</strong>. Free tier: 20 questions/day.</p>
          </>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
