import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import BrandLogo from '../../components/common/BrandLogo';
import './Auth.css';

// Shared "set a new password" screen (staff + provider). Reads the token from the
// emailed link (?token=…). Mirrors ActivatePage. Min length 12 (server policy).
const MIN = 12;

export default function ResetPasswordPage({ submitReset, loginPath = '/login' }: {
  submitReset: (token: string, password: string) => Promise<void>;
  loginPath?: string;
}) {
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
      await submitReset(token, password);
      setDone(true);
      setTimeout(() => navigate(loginPath), 1800);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <BrandLogo />
        <h1>Choose a new password</h1>
        <p>Set a new password to get back into your account.</p>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Reset password</h2>
          {!token ? (
            <>
              <p className="sub">This reset link is missing its token.</p>
              <div className="error-text">Please use the link from your reset email, or request a new one.</div>
              <Link className="btn btn-secondary btn-block" to={loginPath}>Back to sign in</Link>
            </>
          ) : done ? (
            <>
              <p className="sub">Your password has been reset. Taking you to sign in…</p>
              <Link className="btn btn-primary btn-block" to={loginPath}>Sign in now</Link>
            </>
          ) : (
            <>
              <p className="sub">Choose a password (at least {MIN} characters).</p>
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
              <button className="btn btn-primary btn-block" onClick={submit} disabled={busy || password.length < MIN || !confirm}>
                {busy ? 'Resetting…' : 'Reset password & continue'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
