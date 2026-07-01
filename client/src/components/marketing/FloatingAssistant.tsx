import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { askAssistant, type AssistantMessage } from '../../api/assistant';
import RichText from '../common/RichText';

// Always-visible "Ask Eze" chat launcher for public pages. A floating bubble that
// opens a compact chat panel grounded on the MobiCova FAQ (product/site Q&A).
// Health questions are handed off to the Health Buddy.
type Msg = AssistantMessage & { handoff?: 'buddy' };

const GREETING = "Hi! I'm Eze, your MobiCova assistant. Ask me anything about MobiCova — how it works, enrolling, channels or plans.";

export default function FloatingAssistant() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, sending, open]);

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

  // Don't show the launcher on the dedicated full-page assistant (/ask).
  if (pathname === '/ask') return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Eze"
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 8500,
          background: '#0A7B7B', color: '#fff', border: 0, borderRadius: 999,
          padding: '12px 18px', fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(10,123,123,.4)', display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <img src="/apple-touch-icon.png" alt="" style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff' }} /> Ask Eze
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', right: 20, bottom: 20, zIndex: 8500, width: 'min(360px, calc(100vw - 32px))',
      height: 'min(520px, calc(100vh - 40px))', background: '#fff', borderRadius: 14,
      boxShadow: '0 16px 48px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: '1px solid #e2e8e8',
    }}>
      <div style={{ background: '#0A7B7B', color: '#fff', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/apple-touch-icon.png" alt="MobiCova Health" style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', padding: 2, boxSizing: 'border-box' }} />
          <div style={{ lineHeight: 1.15 }}>
            <strong>Ask Eze</strong>
            <div style={{ fontSize: 11, opacity: 0.85 }}>MobiCova Health</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: 'transparent', border: 0, color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-end', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            {m.role === 'assistant' && (
              <img src="/apple-touch-icon.png" alt="MobiCova" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: '#fff' }} />
            )}
            <div>
              <div style={{
                padding: '8px 12px', borderRadius: 10, fontSize: 14, lineHeight: 1.5,
                background: m.role === 'user' ? '#0A7B7B' : '#f1f6f6',
                color: m.role === 'user' ? '#fff' : '#15302f',
              }}>{m.role === 'assistant' ? <RichText text={m.content} onNavigate={(p) => navigate(p)} /> : m.content}</div>
              {m.handoff === 'buddy' && (
                <button onClick={() => navigate('/buddy')} style={{ marginTop: 6, background: '#fff', border: '1px solid #0A7B7B', color: '#0A7B7B', borderRadius: 8, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}>
                  💬 Open the Health Buddy
                </button>
              )}
            </div>
          </div>
        ))}
        {sending && <div style={{ alignSelf: 'flex-start', color: '#5e6e6e', fontSize: 14 }}>…</div>}
        <div ref={endRef} />
      </div>

      <div style={{ borderTop: '1px solid #eef2f2', padding: 8, display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input); }}
          placeholder="Ask about MobiCova…"
          style={{ flex: 1, padding: '9px 11px', border: '1px solid #d6e0e0', borderRadius: 8, fontSize: 14 }}
        />
        <button onClick={() => send(input)} disabled={sending || !input.trim()}
          style={{ background: '#0A7B7B', color: '#fff', border: 0, borderRadius: 8, padding: '0 14px', fontWeight: 600, cursor: 'pointer' }}>
          Send
        </button>
      </div>
    </div>
  );
}
