import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandLogo from '../../components/common/BrandLogo';
import { FEATURE_CATALOG, featureLabel } from '../../lib/featureCatalog';
import { submitFeedback } from '../../api/feedback';
import './ShapePage.css';

const MAX_PRIORITIES = 5;

export default function ShapePage() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', organisation: '', role: '', country: '', useCase: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [priorities, setPriorities] = useState<string[]>([]);
  const [pilot, setPilot] = useState(false);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  function toggleFeature(key: string) {
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
    setPriorities((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : prev);
  }

  function togglePriority(key: string) {
    setPriorities((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_PRIORITIES) return prev;
      return [...prev, key];
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!f.name.trim()) { setError('Please tell us your name.'); return; }
    if (!/.+@.+\..+/.test(f.email)) { setError('Enter a valid email.'); return; }
    if (!consent) { setError('Please tick the consent box so we can contact you.'); return; }
    setStatus('sending');
    try {
      await submitFeedback({
        name: f.name, email: f.email, organisation: f.organisation, role: f.role,
        country: f.country, useCase: f.useCase, wantedFeatures: selected, priorities,
        pilotInterest: pilot, consent,
      });
      setStatus('done');
    } catch {
      setStatus('idle');
      setError('Something went wrong. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <div className="shape">
        <div className="shape-card shape-thanks">
          <div className="shape-logo"><BrandLogo /></div>
          <h1>Thank you 🎉</h1>
          <p>Your priorities are in. We use this to decide what to build next — and we’ll be in touch about early access.</p>
          <button className="shape-btn" onClick={() => navigate('/')}>Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="shape">
      <header className="shape-head">
        <div className="shape-logo" onClick={() => navigate('/')} role="button"><BrandLogo /></div>
        <a className="shape-home" onClick={() => navigate('/')}>← Home</a>
      </header>

      <div className="shape-card">
        <span className="shape-eyebrow">Help shape MobiCova</span>
        <h1>What do you want from MobiCova — and what matters most?</h1>
        <p className="shape-sub">Tell us which features you’d use and rank your top priorities. It takes about a minute and directly shapes our roadmap.</p>

        <form onSubmit={onSubmit} className="shape-form">
          <section>
            <h2>About you</h2>
            <div className="shape-grid">
              <label>Name<input value={f.name} onChange={set('name')} placeholder="Your name" /></label>
              <label>Email<input value={f.email} onChange={set('email')} placeholder="you@example.com" type="email" /></label>
              <label>Organisation<input value={f.organisation} onChange={set('organisation')} placeholder="Company / clinic (optional)" /></label>
              <label>Role<input value={f.role} onChange={set('role')} placeholder="e.g. Founder, HR lead (optional)" /></label>
              <label>Country<input value={f.country} onChange={set('country')} placeholder="e.g. Nigeria (optional)" /></label>
            </div>
          </section>

          <section>
            <h2>What would you use?</h2>
            <p className="shape-note">Tick everything you’re interested in.</p>
            {FEATURE_CATALOG.map((g) => (
              <div key={g.group} className="shape-group">
                <h3>{g.group}</h3>
                <div className="shape-features">
                  {g.features.map((feat) => (
                    <button
                      type="button"
                      key={feat.key}
                      className={`shape-feature ${selected.includes(feat.key) ? 'on' : ''}`}
                      onClick={() => toggleFeature(feat.key)}
                    >
                      <span className="shape-feature-label">{feat.label}</span>
                      {feat.hint && <span className="shape-feature-hint">{feat.hint}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {selected.length > 0 && (
            <section>
              <h2>Your top priorities</h2>
              <p className="shape-note">Click up to {MAX_PRIORITIES}, in order — most important first.</p>
              <div className="shape-features">
                {selected.map((key) => {
                  const rank = priorities.indexOf(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`shape-feature ${rank >= 0 ? 'rank' : ''}`}
                      onClick={() => togglePriority(key)}
                    >
                      {rank >= 0 && <span className="shape-rank">{rank + 1}</span>}
                      <span className="shape-feature-label">{featureLabel(key)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2>Anything else?</h2>
            <textarea
              value={f.useCase}
              onChange={set('useCase')}
              placeholder="What do you want from the platform? Any must-haves, concerns, or ideas…"
              rows={4}
            />
          </section>

          <label className="shape-check">
            <input type="checkbox" checked={pilot} onChange={(e) => setPilot(e.target.checked)} />
            I’m interested in joining an early pilot.
          </label>
          <label className="shape-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            You can contact me about MobiCova. I understand my details are handled per the privacy policy.
          </label>

          {error && <div className="shape-error">{error}</div>}
          <button className="shape-btn" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Submit my priorities'}
          </button>
        </form>
      </div>
    </div>
  );
}
