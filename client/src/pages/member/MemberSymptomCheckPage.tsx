import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendMemberTriage } from '../../api/member';
import './Member.css';

interface Msg { role: 'user' | 'assistant'; content: string; }
const SUGGESTIONS = ['Headache & fever', 'Sore throat', 'Stomach pain'];

export default function MemberSymptomCheckPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setInput('');
    setBusy(true);
    try {
      const res = await sendMemberTriage(msg, sessionId);
      setSessionId(res.id);
      const last = res.messages[res.messages.length - 1];
      setMessages((m) => [...m, { role: 'assistant', content: last?.content || '…' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, I couldn’t respond just now. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="m-screen">
      <header className="m-head-plain">
        <button className="m-back" onClick={() => navigate('/member/care')}>← Care</button>
        <h1>Symptom check</h1>
      </header>

      <div className="m-body m-chat-body">
        <div className="m-bub note">This isn’t a diagnosis. In an emergency, call your local services.</div>
        <div className="m-bub ai">Hi 👋 Tell me what you’re feeling and I’ll help you decide what to do.</div>
        {messages.map((m, i) => (
          <div key={i} className={`m-bub ${m.role === 'user' ? 'me' : 'ai'}`}>{m.content}</div>
        ))}
        {busy && <div className="m-bub ai">…</div>}
        <div ref={endRef} />
      </div>

      <div className="m-chat-foot">
        {messages.length === 0 && (
          <div className="m-chips m-mb">
            {SUGGESTIONS.map((s) => (
              <span key={s} className="m-chip" onClick={() => send(s)}>{s}</span>
            ))}
          </div>
        )}
        <div className="m-chat-input">
          <input
            className="m-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
            placeholder="Type a message…"
          />
          <button className="m-btn primary sm" onClick={() => send(input)} disabled={busy || !input.trim()}>Send</button>
        </div>
      </div>
    </div>
  );
}
