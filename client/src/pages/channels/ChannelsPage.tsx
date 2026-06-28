import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { simulateUssd, simulateWhatsapp } from '../../api/channels';
import './Channels.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

function randomNgPhone(): string {
  return '+23480' + Math.floor(10000000 + Math.random() * 89999999).toString();
}

export default function ChannelsPage() {
  const { user } = useAuth();
  const joinCode = user?.joinCode || '——————';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>WhatsApp &amp; USSD</h1>
          <p>Enrol new members and let existing members self-serve from a basic phone or a chat — no app required. A new number starts enrolment; a member's number opens member services.</p>
        </div>
      </div>

      <div className="join-code-card card card-pad">
        <div>
          <span className="profile-tags-label">Your organisation join code</span>
          <p className="muted small">Members enter this code on WhatsApp or USSD so their enrolment is attributed to {user?.orgName || 'your organisation'}.</p>
        </div>
        <div className="join-code-value">{joinCode}</div>
      </div>

      <div className="channels-grid">
        <UssdSimulator joinCode={joinCode} />
        <WhatsappSimulator joinCode={joinCode} />
      </div>

      <div className="card card-pad connect-card">
        <h3 className="card-title">Connect a real provider</h3>
        <p className="muted small">
          The simulators above hit the same endpoints a live provider would. To go live, point your provider at these URLs — no code change needed.
        </p>
        <dl className="connect-list">
          <div>
            <dt>USSD (e.g. Africa&rsquo;s Talking)</dt>
            <dd><code>{API_BASE}/channels/ussd</code></dd>
          </div>
          <div>
            <dt>WhatsApp (Meta Cloud API)</dt>
            <dd><code>{API_BASE}/channels/whatsapp/webhook</code></dd>
          </div>
        </dl>
        <p className="muted small">
          Set <code>WHATSAPP_VERIFY_TOKEN</code>, <code>WHATSAPP_TOKEN</code> and <code>WHATSAPP_PHONE_ID</code> on the API to enable live WhatsApp replies. USSD needs only a shortcode lease with your aggregator.
        </p>
      </div>
    </div>
  );
}

function UssdSimulator({ joinCode, memberPhone, memberName }: { joinCode: string; memberPhone?: string; memberName?: string }) {
  const [phone, setPhone] = useState('+2348012345678');
  const [text, setText] = useState('');
  const [screen, setScreen] = useState('');
  const [ended, setEnded] = useState(false);
  const [active, setActive] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const render = (raw: string) => {
    setScreen(raw.replace(/^(CON|END)\s?/, ''));
    setEnded(raw.trim().startsWith('END'));
  };

  const dial = async () => {
    setBusy(true);
    try {
      setText('');
      setActive(true);
      setEnded(false);
      render(await simulateUssd({ phoneNumber: phone, text: '' }));
    } finally { setBusy(false); }
  };

  const send = async () => {
    if (!input.trim() || ended) return;
    setBusy(true);
    try {
      const next = text === '' ? input.trim() : `${text}*${input.trim()}`;
      setText(next);
      setInput('');
      render(await simulateUssd({ phoneNumber: phone, text: next }));
    } finally { setBusy(false); }
  };

  return (
    <div className="card card-pad sim-card">
      <h3 className="card-title">USSD simulator</h3>
      <p className="muted small">Mimics a feature phone dialling a shortcode. Try code <strong>{joinCode}</strong>.</p>

      <div className="form-group">
        <label>Caller number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={active && !ended} />
        {memberPhone && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '0.4rem' }}
            disabled={active && !ended}
            onClick={() => setPhone(memberPhone)}
            title="See member services instead of enrolment"
          >
            Use a member’s number{memberName ? ` (${memberName})` : ''}
          </button>
        )}
      </div>

      <div className="ussd-screen">
        {screen ? screen : <span className="muted">Press “Dial” to start a session.</span>}
        {ended && <div className="ussd-ended">— session ended —</div>}
      </div>

      {!active || ended ? (
        <button className="btn btn-primary" onClick={dial} disabled={busy}>
          {busy ? '…' : ended ? 'Dial again' : 'Dial *347*MOBI#'}
        </button>
      ) : (
        <form className="sim-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input placeholder="Type your reply…" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
          <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>Send</button>
        </form>
      )}
    </div>
  );
}

function WhatsappSimulator({ joinCode, memberPhone, memberName }: { joinCode: string; memberPhone?: string; memberName?: string }) {
  const [from, setFrom] = useState(randomNgPhone());
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!input.trim()) return;
    const msg = input.trim();
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setInput('');
    setBusy(true);
    try {
      const res = await simulateWhatsapp({ from, message: msg });
      setMessages((m) => [...m, { role: 'bot', text: res.reply }]);
    } finally { setBusy(false); }
  };

  const reset = () => { setFrom(randomNgPhone()); setMessages([]); };

  return (
    <div className="card card-pad sim-card">
      <div className="card-title-row" style={{ padding: 0, marginBottom: '0.25rem' }}>
        <h3 className="card-title">WhatsApp simulator</h3>
        <button className="btn btn-secondary btn-sm" onClick={reset}>New chat</button>
      </div>
      <p className="muted small">Chats from <strong>{from}</strong>. Send your code <strong>{joinCode}</strong> to begin.</p>
      {memberPhone && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginBottom: '0.5rem' }}
          onClick={() => { setFrom(memberPhone); setMessages([]); }}
          title="Chat as an existing member to see member services"
        >
          Chat as a member{memberName ? ` (${memberName})` : ''}
        </button>
      )}

      <div className="wa-screen">
        {messages.length === 0 ? (
          <span className="muted small">Send any message to start — e.g. “Hi”.</span>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`wa-bubble wa-${m.role}`}>{m.text}</div>
          ))
        )}
      </div>

      <form className="sim-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input placeholder="Message…" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
    </div>
  );
}
