import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { submitLead } from '../../api/marketing';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import { CONTENT } from './contentData';
import './Content.css';

function ContactForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [partnerType, setPartnerType] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!/.+@.+\..+/.test(email)) { setError('Please enter a valid email.'); return; }
    setBusy(true); setError('');
    try {
      await submitLead({ email, company, partnerType });
      setDone(true);
    } catch {
      setError('Could not send right now — please try again or email us.');
    } finally { setBusy(false); }
  };

  if (done) return <div className="ct-form ct-done">✅ Thank you — we’ve received your message and will be in touch shortly.</div>;

  return (
    <div className="ct-form">
      <label>Email *</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organisation.com" />
      <label>Organisation</label>
      <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your company / HMO / employer" />
      <label>I am a…</label>
      <select value={partnerType} onChange={(e) => setPartnerType(e.target.value)}>
        <option value="">Select…</option>
        <option value="insurer">Insurer / HMO</option>
        <option value="employer">Employer</option>
        <option value="telco">Telco</option>
        <option value="clinic">Clinic / Pharmacy</option>
        <option value="developer">Developer</option>
        <option value="other">Other</option>
      </select>
      {error && <div className="error-text">{error}</div>}
      <button className="btn btn-primary" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send message →'}</button>
    </div>
  );
}

export default function ContentPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const page = CONTENT[slug];

  useDocumentMeta({
    title: page ? `${page.title} — MobiCova Health` : 'MobiCova Health',
    description: page?.intro,
  });

  if (!page) {
    return (
      <>
        <SiteHeader />
        <div className="mk"><div className="ct-wrap"><h1>Page not found</h1><a className="ct-back" onClick={() => navigate('/')} role="button">← Home</a></div></div>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="ct-wrap">
          <header className="ct-hero">
            {page.eyebrow && <span className="ct-eyebrow">{page.eyebrow}</span>}
            <h1>{page.title}</h1>
            <p className="ct-intro">{page.intro}</p>
          </header>

          {page.contactForm && <ContactForm />}

          {page.sections.map((s) => (
            <section className="ct-section" key={s.h}>
              <h2>{s.h}</h2>
              {s.p && <p>{s.p}</p>}
              {s.bullets && <ul>{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
            </section>
          ))}

          {page.ctaText && (
            <div className="ct-cta">
              <span>Ready to take the next step?</span>
              <button className="btn btn-amber" onClick={() => navigate(page.ctaTo || '/contact')}>{page.ctaText} →</button>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
