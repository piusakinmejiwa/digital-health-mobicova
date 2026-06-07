import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { activateAccount } from '../../api/auth';
import BrandLogo from '../../components/common/BrandLogo';
import './Auth.css';

// Invited-admin activation: set a password using the token from the welcome
// email link (/activate?token=…), then go to sign in.
export default function ActivatePage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await activateAccount({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not set your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <BrandLogo />

        <h1>Set up your MobiCova account</h1>
        <p>Choose a password to activate your administrator access.</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Set your password</h2>
          {!token ? (
            <>
              <p className="sub">This activation link is missing its token.</p>
              <div className="error-text">Please use the link from your welcome email, or ask your administrator to resend it.</div>
              <Link className="btn btn-secondary btn-block" to="/login">Go to sign in</Link>
            </>
          ) : done ? (
            <>
              <p className="sub">Your password is set. Taking you to sign in…</p>
              <Link className="btn btn-primary btn-block" to="/login">Sign in now</Link>
            </>
          ) : (
            <>
              <p className="sub">Choose a password (at least 8 characters).</p>
              <div className="form-group">
                <label>New password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label>Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button className="btn btn-primary btn-block" onClick={submit} disabled={busy || password.length < 8 || !confirm}>
                {busy ? 'Setting…' : 'Set password & continue'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
