import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subscribeNewsletter } from '../../api/newsletter';
import { getPageAssets } from '../../api/pageAssets';
import HeroIllustration from './HeroIllustration';
import './Newsletter.css';

// Home-page newsletter sign-up: Name, Tel, Email. The image uses the admin-managed
// "newsletter" page asset if set (generate one from Admin → Page Images), else a
// branded illustration.
export default function NewsletterSection() {
  const { data: assets } = useQuery({ queryKey: ['page-assets'], queryFn: getPageAssets, staleTime: 5 * 60 * 1000 });
  const image = assets?.newsletter;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!/.+@.+\..+/.test(email)) { setError('Please enter a valid email.'); return; }
    if (!consent) { setError('Please tick the box so we can email you.'); return; }
    setBusy(true); setError('');
    try {
      await subscribeNewsletter({ name, email, phone, consent });
      setDone(true);
    } catch {
      setError('Could not sign you up right now — please try again.');
    } finally { setBusy(false); }
  };

  return (
    <section className="nl" id="newsletter">
      <div className="mk-wrap">
        <div className="nl-grid">
          <div className="nl-media">
            {image ? <img src={image} alt="Stay in the loop with MobiCova" /> : <HeroIllustration kind="mail" />}
          </div>
          <div className="nl-card">
            <h2>Stay in the loop</h2>
            <p>Health tips, product news and updates from MobiCova — straight to your inbox. No spam, unsubscribe any time.</p>
            {done ? (
              <div className="nl-done">✅ You’re signed up, {name.split(' ')[0] || 'thanks'}! Watch your inbox.</div>
            ) : (
              <div className="nl-form">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address *" />
                <label className="nl-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>I agree to receive emails from MobiCova and to the <a href="/privacy">Privacy Policy</a>.</span>
                </label>
                {error && <div className="nl-error">{error}</div>}
                <button className="btn btn-amber btn-lg" onClick={submit} disabled={busy}>
                  {busy ? 'Signing up…' : 'Subscribe →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
