import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { submitLead } from '../../api/marketing';
import BrandLogo from '../../components/common/BrandLogo';
import './Marketing.css';

// Self-hosted photos (royalty-free, Pexels License) — files live in public/images/.
const HERO_PHOTO = '/images/hero.jpg';

type AudKey = 'insurer' | 'employer' | 'telco';
const AUD: Record<AudKey, { tab: string; h: string; p: string; li: string[]; shot: string; photo: string }> = {
  insurer: {
    tab: 'Insurers',
    h: 'Distribute & service micro-insurance at scale.',
    p: 'Reach the informal market over USSD, enrol in seconds, and reconcile premiums & commission automatically.',
    li: ['NAICOM-ready reporting & returns', 'Premium & commission reconciliation', 'Claims workflow + public API'],
    shot: 'Enrolment, premiums & claims — in real time',
    photo: '/images/insurer.jpg',
  },
  employer: {
    tab: 'Employers',
    h: 'Give every employee health cover that actually gets used.',
    p: 'Onboard your whole roster from a spreadsheet, then let staff book doctors and submit claims from their phone.',
    li: ['Bulk CSV member import', 'Telemedicine & AI triage for staff', 'Utilisation & engagement analytics'],
    shot: 'Connected care, from sign-up to the pharmacy counter',
    photo: '/images/employer.jpg',
  },
  telco: {
    tab: 'Telcos',
    h: 'Turn your subscriber base into a health distribution channel.',
    p: 'Bundle cover and teleconsults with airtime, enrol over USSD, and attribute every member to your network.',
    li: ['USSD-native enrolment', 'Per-partner join codes & attribution', 'White-label member experience'],
    shot: 'Reaching every member, on any phone',
    photo: '/images/telco.jpg',
  },
};

// Hide a missing photo so the parent's gradient fallback shows (never a broken icon).
function hideImg(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none';
}

const PRICING = [
  { name: 'Starter', price: '₦60k', features: ['Up to 2,000 members', 'All 3 services', 'WhatsApp + USSD', 'Email support'], cta: 'Start free trial', cls: 'btn-secondary' },
  { name: 'Growth', price: '₦180k', features: ['Up to 10,000 members', 'API & webhooks', 'White-label portal', 'Analytics & reports'], cta: 'Start free trial', cls: 'btn-amber', pop: true },
  { name: 'Scale', price: '₦340k', features: ['Up to 50,000 members', 'Unlimited intake', 'Custom domain', 'Priority support & SLA'], cta: 'Start free trial', cls: 'btn-secondary' },
  { name: 'Enterprise', price: 'Custom', features: ['Unlimited members', 'SSO + custom SLA', 'Dedicated CSM', 'On-prem option'], cta: 'Contact sales', cls: 'btn-primary' },
];

// Real partner names from the ecosystem — shown as wordmarks (no logo files needed).
const TRUST = ['AXA Mansard', 'Leadway', 'Hygeia HMO', 'MTN', 'HealthPlus'];

// Footer columns. Each link scrolls to a section or navigates to a route — no dead links.
const FOOT_COLS: { h: string; items: [string, string][] }[] = [
  { h: 'Platform', items: [['Telemedicine', 'services'], ['AI Assistant', 'services'], ['Insurance', 'services'], ['Channels', 'services']] },
  { h: 'Company', items: [['About', 'audiences'], ['Partners', 'audiences'], ['Careers', 'demo'], ['Contact', 'demo']] },
  { h: 'Developers', items: [['API docs', '/login'], ['Webhooks', '/login'], ['Pricing', 'pricing'], ['Security', '/login']] },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function MarketingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [aud, setAud] = useState<AudKey>('insurer');
  const a = AUD[aud];

  // Footer link target: a route ('/…') navigates, anything else scrolls to a section.
  const footGo = (t: string) => (t.startsWith('/') ? navigate(t) : scrollTo(t));

  // Demo form
  const [form, setForm] = useState({ email: '', company: '', partnerType: '', memberBand: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!/.+@.+\..+/.test(form.email)) { setError('Enter a valid work email.'); return; }
    setBusy(true);
    setError('');
    try {
      await submitLead(form);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mk">
      {/* Nav */}
      <header className="mk-nav">
        <div className="mk-wrap in">
          <div className="brand"><BrandLogo /></div>
          <nav className="links">
            <a onClick={() => scrollTo('services')}>Platform</a>
            <a onClick={() => scrollTo('audiences')}>Who it’s for</a>
            <a onClick={() => scrollTo('pricing')}>Pricing</a>
          </nav>
          <div className="right">
            {user ? (
              <a className="si" onClick={() => navigate('/dashboard')}>Go to dashboard</a>
            ) : (
              <a className="si" onClick={() => navigate('/login')}>Sign in</a>
            )}
            <button className="btn btn-amber" onClick={() => scrollTo('demo')}>Book a demo</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="mk-wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Health Platform · Distributor · Infrastructure</span>
              <h1>Health cover, telemedicine &amp; AI triage for <em>every African</em>, on any phone.</h1>
              <p>One platform for insurers, employers and telcos to enrol members and deliver care — over an app, WhatsApp or USSD.</p>
              <div className="cta">
                <button className="btn btn-amber btn-lg" onClick={() => scrollTo('demo')}>Book a demo →</button>
                <button className="btn btn-outline btn-lg" onClick={() => scrollTo('services')}>See how it works</button>
              </div>
            </div>
            <div className="hero-media">
              <img src={HERO_PHOTO} alt="A MobiCova member accessing health care in a Nigerian clinic" onError={hideImg} />
            </div>
          </div>
          <div className="trust">
            <div className="lb">Trusted by partners across the ecosystem</div>
            <div className="logos">
              {TRUST.map((n) => <span key={n} className="logo-chip">{n}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section className="sec" id="audiences">
        <div className="mk-wrap sec-center">
          <div className="sec-tag">Built for your business</div>
          <h2>One platform, tailored to how you reach people</h2>
          <div className="aud-tabs">
            {(Object.keys(AUD) as AudKey[]).map((k) => (
              <button key={k} className={k === aud ? 'on' : ''} onClick={() => setAud(k)}>{AUD[k].tab}</button>
            ))}
          </div>
        </div>
        <div className="mk-wrap">
          <div className="aud-grid">
            <div className="aud-copy">
              <h3>{a.h}</h3>
              <p>{a.p}</p>
              <ul>{a.li.map((x) => <li key={x}>{x}</li>)}</ul>
              <button className="btn btn-primary aud-cta" onClick={() => scrollTo('demo')}>Book a demo →</button>
            </div>
            <div className="aud-shot">
              <img src={a.photo} alt={`${a.tab} — MobiCova members`} onError={hideImg} />
              <div className="shot-cap">{a.shot}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="sec alt" id="services">
        <div className="mk-wrap sec-center">
          <div className="sec-tag">The platform</div>
          <h2>Three integrated services, one member record</h2>
          <p className="lead">MobiCova connects people to care — it doesn’t replace the clinic. Every service is delivered through licensed partners while you own the member relationship and the data layer.</p>
        </div>
        <div className="mk-wrap">
          <div className="svc-grid">
            <div className="svc"><div className="ic teal">✚</div><h3>Telemedicine</h3><p>Talk to licensed doctors over secure <b>video or voice calls</b>, with e-prescriptions fulfilled by pharmacy partners.</p></div>
            <div className="svc"><div className="ic amber">✦</div><h3>AI Health Assistant</h3><p>Symptom triage and health guidance powered by Claude, with a rule-based fallback so it always responds.</p></div>
            <div className="svc"><div className="ic blue">◎</div><h3>Health-linked Insurance</h3><p>Plan catalog, member enrolment and NGN-native premium checkout, with claims and commission reconciliation built in.</p></div>
          </div>
          <div className="channels">
            <div className="channel"><span className="d" style={{ background: '#0a7b7b' }} /> App</div>
            <div className="channel"><span className="d" style={{ background: '#25D366' }} /> WhatsApp</div>
            <div className="channel"><span className="d" style={{ background: '#f4a23c' }} /> USSD</div>
            <div className="channel"><span className="d" style={{ background: '#3b82f6' }} /> Web portal</div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="sec stats">
        <div className="mk-wrap">
          <div className="row4">
            <div className="st"><b>3</b><span>Tier-1 services in one platform</span></div>
            <div className="st"><b className="g">2</b><span>taps to enrol over USSD</span></div>
            <div className="st"><b>100%</b><span>of members reachable on a basic phone</span></div>
            <div className="st"><b className="g">&lt;1<span style={{ fontSize: '1.2rem' }}>min</span></b><span>to first AI triage response</span></div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="sec" id="pricing">
        <div className="mk-wrap sec-center">
          <div className="sec-tag">Pricing</div>
          <h2>Simple pricing that scales with you</h2>
          <p className="lead">A monthly platform fee plus usage. No setup cost, no per-seat charges — start on a free trial and grow.</p>
        </div>
        <div className="mk-wrap">
          <div className="price-grid">
            {PRICING.map((p) => (
              <div key={p.name} className={`pcard ${p.pop ? 'pop' : ''}`}>
                {p.pop && <div className="tagp">Most popular</div>}
                <div className="pn">{p.name}</div>
                <div className="pp">{p.price}{p.price !== 'Custom' && <span>/mo</span>}</div>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <button className={`btn ${p.cls} btn-block`} onClick={() => scrollTo('demo')}>{p.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section className="sec alt" id="demo">
        <div className="mk-wrap">
          <div className="demo">
            <div className="l">
              <h2>See MobiCova with your own member data.</h2>
              <p>A 30-minute walkthrough tailored to your book of business.</p>
              <ul>
                <li>Live USSD &amp; WhatsApp enrolment demo</li>
                <li>Pricing modelled for your volume</li>
                <li>Integration &amp; API walkthrough</li>
              </ul>
            </div>
            <div className="r">
              {sent ? (
                <div className="demo-thanks">
                  <div className="demo-check">✓</div>
                  <h3>Thanks!</h3>
                  <p>Our team will reach out to <b>{form.email}</b> to schedule your demo.</p>
                </div>
              ) : (
                <>
                  <h3>Book a demo</h3>
                  <input className="fld" placeholder="Work email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <input className="fld" placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  <select className="fld" value={form.partnerType} onChange={(e) => setForm({ ...form, partnerType: e.target.value })}>
                    <option value="">Partner type…</option>
                    <option>Insurer / underwriter</option><option>Employer / HR</option>
                    <option>Telco / distributor</option><option>Clinic / provider</option>
                  </select>
                  <select className="fld" value={form.memberBand} onChange={(e) => setForm({ ...form, memberBand: e.target.value })}>
                    <option value="">Approx. members…</option>
                    <option>Under 2,000</option><option>2,000–10,000</option>
                    <option>10,000–50,000</option><option>50,000+</option>
                  </select>
                  {error && <div className="error-text">{error}</div>}
                  <button className="btn btn-primary btn-block demo-submit" onClick={submit} disabled={busy}>
                    {busy ? 'Sending…' : 'Request demo →'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mk-foot">
        <div className="mk-wrap">
          <div className="cols">
            <div>
              <div className="brand"><BrandLogo /></div>
              <p className="foot-blurb">Digital health infrastructure connecting Africans to care, on any phone.</p>
            </div>
            {FOOT_COLS.map((col) => (
              <div key={col.h}>
                <h5>{col.h}</h5>
                {col.items.map(([label, t]) => (
                  <a key={label} onClick={() => footGo(t)}>{label}</a>
                ))}
              </div>
            ))}
          </div>
          <div className="bottom">
            <span>© 2026 MobiCova Health. All rights reserved.</span>
            <span>Privacy · Terms · NDPR</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
