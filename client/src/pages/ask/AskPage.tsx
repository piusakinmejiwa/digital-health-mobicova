import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { askAssistant, type AssistantMessage } from '../../api/assistant';

type Msg = AssistantMessage & { handoff?: 'buddy' };

const GREETING =
  "Hi! I'm Eze, your MobiCova assistant. Ask me anything about MobiCova — how it works, enrolling, our channels, plans, or data safety. (For a health question, I'll point you to the free Health Buddy.)";

const SUGGESTIONS = ['What is MobiCova?', 'How do I enrol?', 'Do I need a smartphone?', 'Is my data safe?'];

export default function AskPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setSending(true);
    try {
      const res = await askAssistant([...history, { role: 'user', content: q }], i18n.resolvedLanguage);
      setMsgs((m) => [...m, { role: 'assistant', content: res.reply, handoff: res.handoff }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 56px' }}>
          <h1 style={{ marginBottom: 4 }}>Ask Eze</h1>
          <p style={{ color: '#5e6e6e', marginTop: 0 }}>Your MobiCova assistant — questions about the platform, answered.</p>

          <div style={{ border: '1px solid #e2e8e8', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <div style={{ maxHeight: 460, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {msgs.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: 12, lineHeight: 1.55,
                    background: m.role === 'user' ? '#0A7B7B' : '#f1f6f6',
                    color: m.role === 'user' ? '#fff' : '#15302f',
                  }}>{m.content}</div>
                  {m.handoff === 'buddy' && (
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={() => navigate('/buddy')}>
                      💬 Open the Health Buddy
                    </button>
                  )}
                </div>
              ))}
              {sending && <div style={{ alignSelf: 'flex-start', color: '#5e6e6e', fontSize: 14 }}>…</div>}
              <div ref={endRef} />
            </div>

            <div style={{ borderTop: '1px solid #eef2f2', padding: 10, display: 'flex', gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
                placeholder="Ask about MobiCova…"
                style={{ flex: 1, padding: '10px 12px', border: '1px solid #d6e0e0', borderRadius: 8 }}
              />
              <button className="btn btn-primary" onClick={() => send(input)} disabled={sending || !input.trim()}>Send</button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} className="btn btn-secondary btn-sm" onClick={() => send(s)} disabled={sending}>{s}</button>
            ))}
          </div>

          <p className="muted small" style={{ marginTop: 16 }}>
            This assistant answers questions about MobiCova, not personal medical questions. For health information,
            use the free <a onClick={() => navigate('/buddy')} style={{ color: '#0A7B7B', cursor: 'pointer' }}>Health Buddy</a>.
          </p>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
