import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/common/BrandLogo';
import { chatWithBuddy } from '../../api/buddy';
import type { BuddyMessage, BuddySource } from '../../api/buddy';
import './BuddyPage.css';

type Msg = BuddyMessage & { sources?: BuddySource[]; safety?: 'ok' | 'crisis' | 'emergency' };

const GREETING: Msg =
  { role: 'assistant', content: "Hi! I'm the MobiCova Health Buddy 👋 Ask me a basic health question and I'll share what trusted sources say. I'm not a doctor — for anything serious I'll point you to one." };

const SUGGESTIONS = ['What helps a fever?', 'What are malaria symptoms?', 'How do I stay hydrated?', 'Tips for a sore throat'];

export default function BuddyPage() {
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    const history = msgs.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content }));
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setInput('');
    setSending(true);
    try {
      const res = await chatWithBuddy([...history, { role: 'user', content: q }]);
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
        <a className="buddy-home" onClick={() => navigate('/')}>← Home</a>
      </header>

      <div className="buddy-shell">
        <div className="buddy-title">
          <h1>Health Buddy</h1>
          <p className="buddy-disclaimer">General health info from trusted sources — <strong>not a diagnosis</strong>. For your own health, see a clinician.</p>
        </div>

        <div className="buddy-chat">
          {msgs.map((m, i) => (
            <div key={i} className={`buddy-row ${m.role}`}>
              <div className={`buddy-bubble ${m.role} ${m.safety && m.safety !== 'ok' ? 'alert' : ''}`}>
                {m.content.split('\n').map((line, j) => <p key={j}>{line || ' '}</p>)}
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
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
          </div>
        )}

        <form className="buddy-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a basic health question…"
            maxLength={500}
          />
          <button type="submit" disabled={sending || !input.trim()}>Send</button>
        </form>
        <p className="buddy-foot">If you may be in danger, call <strong>112</strong>. Free tier: 20 questions/day.</p>
      </div>
    </div>
  );
}
