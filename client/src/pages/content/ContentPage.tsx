import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import { submitContact } from '../../api/contact';
import { useDocumentMeta } from '../../lib/useDocumentMeta';
import HeroIllustration from '../../components/marketing/HeroIllustration';
import { CONTENT } from './contentData';
import './Content.css';

const empty = { name: '', email: '', phone: '', organisation: '', enquiryType: '', subject: '', message: '', consent: false };

function ContactForm() {
  const [f, setF] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof empty) => (v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const send = async () => {
    if (!f.name.trim()) { setError('Please tell us your name.'); return; }
    if (!/.+@.+\..+/.test(f.email)) { setError('Please enter a valid email.'); return; }
    if (!f.message.trim()) { setError('Please add a short message.'); return; }
    if (!f.consent) { setError('Please tick the consent box so we can reply.'); return; }
    setBusy(true); setError('');
    try {
      await submitContact(f);
      setDone(true);
    } catch {
      setError('Could not send right now — please try again shortly.');
    } finally { setBusy(false); }
  };

  if (done) return <div className="ct-form ct-done">✅ Thank you, {f.name.split(' ')[0] || 'there'} — we’ve received your message and will be in touch shortly.</div>;

  return (
    <div className="ct-form ct-form-wide">
      <div className="ct-row">
        <div><label>Full name *</label><input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="Your name" /></div>
        <div><label>Email *</label><input value={f.email} onChange={(e) => set('email')(e.target.value)} placeholder="you@organisation.com" /></div>
      </div>
      <div className="ct-row">
        <div><label>Phone</label><input value={f.phone} onChange={(e) => set('phone')(e.target.value)} placeholder="+234…" /></div>
        <div><label>Organisation</label><input value={f.organisation} onChange={(e) => set('organisation')(e.target.value)} placeholder="Company / HMO / employer" /></div>
      </div>
      <div className="ct-row">
        <div>
          <label>I am a…</label>
          <select value={f.enquiryType} onChange={(e) => set('enquiryType')(e.target.value)}>
            <option value="">Select…</option>
            <option value="insurer">Insurer / HMO</option>
            <option value="employer">Employer</option>
            <option value="telco">Telco</option>
            <option value="clinic">Clinic / Pharmacy</option>
            <option value="developer">Developer / Partner</option>
            <option value="member">Member / Patient</option>
            <option value="media">Media / Press</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div><label>Subject</label><input value={f.subject} onChange={(e) => set('subject')(e.target.value)} placeholder="What is this about?" /></div>
      </div>
      <label>Message *</label>
      <textarea rows={4} value={f.message} onChange={(e) => set('message')(e.target.value)} placeholder="How can we help?" />
      <label className="ct-consent">
        <input type="checkbox" checked={f.consent} onChange={(e) => set('consent')(e.target.checked)} />
        <span>I agree that MobiCova may use these details to respond to my enquiry, per the <a href="/privacy">Privacy Policy</a>.</span>
      </label>
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
    jsonLd: page?.faq && page.faq.length > 0 ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    } : null,
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
          <header className="ct-hero ct-hero-grid">
            <div className="ct-hero-text">
              {page.eyebrow && <span className="ct-eyebrow">{page.eyebrow}</span>}
              <h1>{page.title}</h1>
              <p className="ct-intro">{page.intro}</p>
              {page.lead && <p className="ct-lead">{page.lead}</p>}
            </div>
            <div className="ct-hero-media">
              {page.heroImage
                ? <img src={page.heroImage} alt={page.title} loading="eager" />
                : <HeroIllustration kind={page.illustration} />}
            </div>
          </header>

          {page.contactForm && <ContactForm />}

          {page.sections.map((s) => (
            <section className="ct-section" key={s.h}>
              <h2>{s.h}</h2>
              {s.p && <p>{s.p}</p>}
              {s.bullets && <ul>{s.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
            </section>
          ))}

          {page.faq && page.faq.length > 0 && (
            <div className="ct-faq">
              <h2>Frequently asked</h2>
              {page.faq.map((f) => (
                <div className="ct-faq-item" key={f.q}>
                  <h3>{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          )}

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
