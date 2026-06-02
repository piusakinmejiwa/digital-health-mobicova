import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMe } from '../../api/auth';
import './Auth.css';

// Landing page for the SAML round-trip. The server redirects here with the
// freshly minted JWT in the URL fragment (#token=…) — the fragment never leaves
// the browser, so the token stays out of server logs and Referer headers.
export default function SsoCallbackPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against React 18 double-invoke in dev
    ran.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    // Clear the fragment so the token isn't left sitting in the address bar.
    window.history.replaceState(null, '', window.location.pathname);

    if (!token) {
      setError('Sign-in did not complete. Please try again.');
      return;
    }

    // Persist first so the api client attaches the token when fetching the profile.
    localStorage.setItem('mobicova_token', token);
    getMe()
      .then((user) => {
        login(token, user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => {
        localStorage.removeItem('mobicova_token');
        setError('We could not load your account after sign-in. Please try again.');
      });
  }, [login, navigate]);

  return (
    <div className="auth-wrap">
      <div className="auth-form-side" style={{ width: '100%' }}>
        <div className="auth-card">
          {error ? (
            <>
              <h2>Single sign-on failed</h2>
              <div className="error-text">{error}</div>
              <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <h2>Signing you in…</h2>
              <p className="sub">Completing single sign-on. One moment.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
