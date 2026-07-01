import { useState } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../../components/common/BrandLogo';
import './Auth.css';

// Shared "forgot password" request screen for both the staff dashboard and the
// provider portal. The caller passes the API call + where "back to sign in" goes.
// The success state is intentionally generic (doesn't confirm the email exists).
export default function ForgotPasswordPage({ requestReset, loginPath = '/login' }: {
  requestReset: (email: string) => Promise<void>;
  loginPath?: string;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true); setError('');
    try { await requestReset(email.trim()); setSent(true); }
    catch { setError('Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <BrandLogo />
        <h1>Reset your password</h1>
        <p>We&rsquo;ll email you a secure link to set a new one.</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          {sent ? (
            <>
              <h2>Check your email</h2>
              <p className="sub">If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 1 hour.</p>
              <Link className="btn btn-primary btn-block" to={loginPath}>Back to sign in</Link>
            </>
          ) : (
            <>
              <h2>Forgot your password?</h2>
              <p className="sub">Enter your email and we&rsquo;ll send you a reset link.</p>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary btn-block" onClick={submit} disabled={busy || !email.trim()}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <Link className="btn btn-link btn-block" to={loginPath}>Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
