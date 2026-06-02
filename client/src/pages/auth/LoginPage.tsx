import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { loginUser } from '../../api/auth';
import { ssoStatus, beginSso } from '../../api/sso';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

interface FormValues {
  email: string;
  password: string;
}

// Friendly copy for the ?sso_error=… codes the server appends when an SSO
// round-trip is bounced back to the login screen.
const SSO_ERRORS: Record<string, string> = {
  unknown_org: 'We couldn’t find that workspace. Check the ID with your administrator.',
  org_suspended: 'This organisation is suspended. Contact MobiCova support.',
  not_configured: 'Single sign-on isn’t set up for that workspace yet.',
  idp_error: 'We couldn’t reach your identity provider. Please try again.',
  invalid_response: 'Your identity provider’s response could not be verified.',
  no_email: 'Your identity provider didn’t share an email address.',
  no_account: 'No MobiCova account matches your SSO email. Ask your admin to add you first.',
};

export default function LoginPage() {
  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: 'admin@axamansard.demo', password: 'password123' },
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // SSO panel state
  const [ssoMode, setSsoMode] = useState(false);
  const [workspace, setWorkspace] = useState('');
  const [ssoBusy, setSsoBusy] = useState(false);
  const [ssoError, setSsoError] = useState('');

  // Surface an SSO failure passed back via the URL, then clean the query string.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('sso_error');
    if (code) {
      setSsoMode(true);
      setSsoError(SSO_ERRORS[code] || 'Single sign-on did not complete. Please try again.');
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const onSubmit = async (values: FormValues) => {
    setError('');
    setLoading(true);
    try {
      const res = await loginUser(values);
      login(res.token, res.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onSso = async () => {
    const slug = workspace.trim().toLowerCase();
    if (!slug) return;
    setSsoBusy(true);
    setSsoError('');
    try {
      const status = await ssoStatus(slug);
      if (!status.enabled) {
        setSsoError('Single sign-on isn’t enabled for that workspace.');
        setSsoBusy(false);
        return;
      }
      beginSso(slug); // full-page redirect to the IdP
    } catch {
      setSsoError('We couldn’t start single sign-on. Please try again.');
      setSsoBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-hero">
        <div className="logo-mark">M</div>
        <h1>The health platform behind Nigeria&rsquo;s insurers, employers &amp; telcos.</h1>
        <p>
          MobiCova connects your members to telemedicine, AI health guidance, and health-linked
          insurance — across app, WhatsApp, and USSD.
        </p>
        <ul>
          <li><span>✓</span> Telemedicine with licensed provider partners</li>
          <li><span>✓</span> AI symptom triage that guides members to the right care</li>
          <li><span>✓</span> Health-linked insurance distribution &amp; enrolment</li>
        </ul>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          <h2>Partner sign in</h2>
          <p className="sub">Access your MobiCova health platform.</p>

          {!ssoMode ? (
            <>
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="form-group">
                  <label>Work email</label>
                  <input type="email" {...register('email', { required: true })} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" {...register('password', { required: true })} />
                </div>
                {error && <div className="error-text">{error}</div>}
                <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
              <div className="auth-divider"><span>or</span></div>
              <button className="btn btn-secondary btn-block" onClick={() => { setError(''); setSsoMode(true); }}>
                Sign in with SSO
              </button>
              <div className="demo-hint">
                <strong>Demo:</strong> admin@axamansard.demo / password123
              </div>
              <p className="auth-switch">
                New partner? <Link to="/register">Create an organisation</Link>
              </p>
            </>
          ) : (
            <>
              <div className="form-group">
                <label>Workspace ID</label>
                <input
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  placeholder="e.g. axa-mansard"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') onSso(); }}
                />
                <p className="muted small">Your organisation’s workspace ID (slug). Your admin can find it in Settings.</p>
              </div>
              {ssoError && <div className="error-text">{ssoError}</div>}
              <button className="btn btn-primary btn-block" onClick={onSso} disabled={ssoBusy || !workspace.trim()}>
                {ssoBusy ? 'Redirecting…' : 'Continue with SSO'}
              </button>
              <button className="btn btn-link btn-block" onClick={() => { setSsoError(''); setSsoMode(false); }}>
                ← Back to password sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
