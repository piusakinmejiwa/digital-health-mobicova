import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { sendTriageMessage, listMembers } from '../../api/resources';
import type { TriageMessage, TriageSession } from '../../types';
import { triageLabel } from '../../lib/format';
import './Assistant.css';

interface LocationState { memberId?: string; memberName?: string }

const STARTERS = [
  'I have had a fever and headache for two days',
  'My child has a rash and is scratching a lot',
  'I feel chest pain and shortness of breath',
  'What vaccinations does a newborn need?',
];

export default function AssistantPage() {
  const location = useLocation();
  const initial = (location.state as LocationState) || {};
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers });

  const [memberId, setMemberId] = useState(initial.memberId || '');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<TriageMessage[]>([]);
  const [session, setSession] = useState<TriageSession | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    try {
      const res = await sendTriageMessage({ sessionId, memberId: memberId || undefined, message: text });
      setSessionId(res.id);
      setSession(res);
      setMessages(res.messages);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSessionId(undefined); setMessages([]); setSession(null);
  };

  return (
    <div className="page assistant-page">
      <div className="page-header">
        <div>
          <h1>AI Health Assistant</h1>
          <p>Symptom triage and health guidance. Guides members to the right level of care — it does not diagnose.</p>
        </div>
        <div className="assistant-controls">
          <select value={memberId} onChange={(e) => { setMemberId(e.target.value); reset(); }}>
            <option value="">Anonymous session</option>
            {members?.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
          {messages.length > 0 && <button className="btn btn-secondary btn-sm" onClick={reset}>New session</button>}
        </div>
      </div>

      <div className="assistant-layout">
        <div className="chat-card card">
          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div className="chat-orb">✦</div>
                <h3>How can I help with your health today?</h3>
                <p className="muted">Describe symptoms or ask a health question. Try one of these:</p>
                <div className="starters">
                  {STARTERS.map((s) => (
                    <button key={s} className="starter" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`bubble-row ${m.role}`}>
                  {m.role === 'assistant' && <div className="bubble-avatar">✦</div>}
                  <div className={`bubble ${m.role}`}>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="bubble-row assistant">
                <div className="bubble-avatar">✦</div>
                <div className="bubble assistant typing"><span></span><span></span><span></span></div>
              </div>
            )}
          </div>

          <form
            className="chat-input"
            onSubmit={(e) => { e.preventDefault(); send(input); }}
          >
            <input
              placeholder="Describe symptoms or ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={!input.trim() || sending}>Send</button>
          </form>
        </div>

        <aside className="triage-panel card card-pad">
          <h3 className="card-title">Triage outcome</h3>
          {!session ? (
            <p className="muted small">The assistant&rsquo;s triage assessment will appear here as the conversation develops.</p>
          ) : (
            <>
              <div className={`triage-result triage-${session.triage_level}`}>
                {triageLabel(session.triage_level)}
              </div>
              <div className="triage-field">
                <span className="profile-tags-label">Recommended next step</span>
                <p>{session.recommendation || '—'}</p>
              </div>
              <div className="triage-field">
                <span className="profile-tags-label">Engine</span>
                <p className="muted small">{session.engine === 'claude' ? 'Claude (live AI)' : 'Rule-based fallback'}</p>
              </div>
              {(session.triage_level === 'urgent' || session.triage_level === 'gp') && (
                <p className="triage-cta small">This member may benefit from a telemedicine consultation. Book one from their profile or the Telemedicine page.</p>
              )}
            </>
          )}
          <div className="triage-disclaimer">
            For emergencies, advise the member to call local emergency services or go to the nearest hospital immediately.
          </div>
        </aside>
      </div>
    </div>
  );
}
