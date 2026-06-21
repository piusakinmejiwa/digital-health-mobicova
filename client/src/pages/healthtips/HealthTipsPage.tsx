import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import HeroIllustration from '../../components/marketing/HeroIllustration';
import { subscribeHealthTips, unsubscribeHealthTips, type HealthTipChannel } from '../../api/healthTips';
import { getPageAssets } from '../../api/pageAssets';
import './HealthTips.css';

const CHANNELS: { key: HealthTipChannel; label: string; needs: 'sms' | 'whatsapp' | 'email' }[] = [
  { key: 'sms', label: 'SMS', needs: 'sms' },
  { key: 'whatsapp', label: 'WhatsApp', needs: 'whatsapp' },
  { key: 'email', label: 'Email', needs: 'email' },
];

export default function HealthTipsPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  return token ? <Unsubscribe token={token} /> : <Subscribe />;
}

function Subscribe() {
  const [form, setForm] = useState({ fullName: '', smsNumber: '', whatsappNumber: '', email: '' });
  const [channels, setChannels] = useState<HealthTipChannel[]>(['sms', 'whatsapp', 'email']);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [hero, setHero] = useState<string | undefined>();

  useEffect(() => { getPageAssets().then((a) => setHero(a['health-tips'])).catch(() => {}); }, []);

  const toggle = (c: HealthTipChannel) =>
    setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const submit = async () => {
    setError('');
    if (!form.fullName.trim()) { setError('Please enter your full name.'); return; }
    if (channels.length === 0) { setError('Choose at least one channel to receive tips on.'); return; }
    // Ensure each chosen channel has a contact value.
    for (const c of CHANNELS) {
      if (channels.includes(c.key) && !form[`${c.needs}Number` as 'smsNumber' | 'whatsappNumber'] && !(c.key === 'email' && form.email)) {
        if (c.key === 'email' ? !form.email.trim() : !form[`${c.needs}Number` as 'smsNumber' | 'whatsappNumber'].trim()) {
          setError(`Add your ${c.label} contact, or untick ${c.label}.`); return;
        }
      }
    }
    if (!consent) { setError('Please agree to receive health tips.'); return; }
    setBusy(true);
    try {
      await subscribeHealthTips({
        fullName: form.fullName.trim(),
        smsNumber: form.smsNumber.trim(),
        whatsappNumber: form.whatsappNumber.trim(),
        email: form.email.trim(),
        channels,
        consent,
      });
      setDone(true);
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="ht-wrap">
          <div className="ht-hero">
            <div className="ht-hero-copy">
              <span className="ht-eyebrow">Free service</span>
              <h1>Daily Health Tips</h1>
              <p>One short, practical health tip a day — straight to your phone or inbox. Simple guidance to help you and your family stay well, on any device. No cost, unsubscribe anytime.</p>
              <ul className="ht-points">
                <li>📲 Delivered by SMS, WhatsApp or email — your choice</li>
                <li>🩺 Trusted, plain-language health guidance</li>
                <li>🔒 Your details are private and never sold</li>
              </ul>
            </div>
            <div className="ht-hero-art">
              {hero ? <img src={hero} alt="Daily health tips" /> : <HeroIllustration kind="message" />}
            </div>
          </div>

          {done ? (
            <div className="ht-card ht-done">
              <div className="ht-done-ico">✓</div>
              <h2>You’re signed up!</h2>
              <p>Welcome to MobiCova Daily Health Tips. You’ll start receiving tips on the channel(s) you chose. You can unsubscribe any time from the link in any message.</p>
            </div>
          ) : (
            <div className="ht-card">
              <h2>Sign up in seconds</h2>
              {error && <div className="ht-error">{error}</div>}
              <label className="ht-field">
                <span>Full name *</span>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Amaka Obi" />
              </label>
              <label className="ht-field">
                <span>SMS number</span>
                <input value={form.smsNumber} onChange={(e) => setForm({ ...form, smsNumber: e.target.value })} placeholder="+234 801 234 5678" />
              </label>
              <label className="ht-field">
                <span>WhatsApp number</span>
                <input value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} placeholder="+234 801 234 5678" />
              </label>
              <label className="ht-field">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </label>

              <div className="ht-field">
                <span>Send my tips by</span>
                <div className="ht-chans">
                  {CHANNELS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`ht-chan ${channels.includes(c.key) ? 'on' : ''}`}
                      onClick={() => toggle(c.key)}
                    >
                      {channels.includes(c.key) ? '✓ ' : ''}{c.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="ht-consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I agree to receive Daily Health Tips from MobiCova and accept the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
              </label>

              <button className="ht-submit" onClick={submit} disabled={busy}>
                {busy ? 'Signing you up…' : 'Get my daily tips'}
              </button>
              <p className="ht-fine">General health guidance only — not a diagnosis or a substitute for professional care.</p>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}

function Unsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  useEffect(() => {
    unsubscribeHealthTips(token)
      .then((r) => setState(r.unsubscribed ? 'done' : 'error'))
      .catch(() => setState('error'));
  }, [token]);

  return (
    <>
      <SiteHeader />
      <div className="mk">
        <div className="ht-wrap">
          <div className="ht-card ht-done">
            {state === 'working' && <p>Unsubscribing…</p>}
            {state === 'done' && (
              <>
                <div className="ht-done-ico">✓</div>
                <h2>You’ve been unsubscribed</h2>
                <p>You won’t receive any more Daily Health Tips. You can re-subscribe any time from the Health Tips page.</p>
              </>
            )}
            {state === 'error' && (
              <>
                <h2>Link not recognised</h2>
                <p>That unsubscribe link is invalid or has already been used. If you keep receiving tips, contact us and we’ll remove you.</p>
              </>
            )}
          </div>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
