import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { loginUser, mfaChallenge } from '../../api/auth';
import { ssoStatus, beginSso } from '../../api/sso';
import { getOrgBrandingBySlug, type OrgBrandingPublic } from '../../api/publicOrg';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../../components/common/BrandLogo';
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
    defaultValues: { email: '', password: '' },
  });
  const { login } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Branded login: when reached via /o/<slug>/login, theme the page to that org.
  const [branding, setBranding] = useState<OrgBrandingPublic | null>(null);
  useEffect(() => {
    if (!slug) return;
    getOrgBrandingBySlug(slug).then(setBranding).catch(() => setBranding(null));
  }, [slug]);

  // SSO panel state
  const [ssoMode, setSsoMode] = useState(false);
  const [workspace, setWorkspace] = useState(slug || '');
  const [ssoBusy, setSsoBusy] = useState(false);
  const [ssoError, setSsoError] = useState('');

  // MFA second-step state. When the server demands a second factor, it returns a
  // short-lived pending token; we swap that + a code for the real session.
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

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
      if (res.mfaRequired && res.mfaToken) {
        setMfaToken(res.mfaToken);
        setMfaCode('');
        setMfaError('');
        return;
      }
      if (res.token && res.user) {
        login(res.token, res.user);
        // Platform admins land on the Admin Console; everyone else on their dashboard.
        navigate(res.user.isPlatformAdmin ? '/admin' : '/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onMfaSubmit = async () => {
    const code = mfaCode.trim();
    if (!code) return;
    setMfaBusy(true);
    setMfaError('');
    try {
      const res = await mfaChallenge({ mfaToken, code });
      login(res.token, res.user);
      navigate(res.user.isPlatformAdmin ? '/admin' : '/dashboard');
    } catch (err: any) {
      setMfaError(err.response?.data?.error || 'Verification failed');
    } finally {
      setMfaBusy(false);
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

  const brandStyle: CSSProperties | undefined = branding
    ? ({ '--primary': branding.primaryColor, '--primary-dark': branding.primaryColor } as CSSProperties)
    : undefined;

  return (
    <div className="auth-wrap" style={brandStyle}>
      <div className="auth-hero">
        <BrandLogo chip />

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
          <h2>{branding ? `${branding.displayName} sign in` : 'Partner sign in'}</h2>
          <p className="sub">
            {branding ? `Sign in to ${branding.displayName} on MobiCova.` : 'Access your MobiCova health platform.'}
          </p>

          {mfaToken ? (
            <>
              <div className="form-group">
                <label>Authentication code</label>
                <input
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') onMfaSubmit(); }}
                />
                <p className="muted small">
                  Enter the 6-digit code from your authenticator app, or one of your backup codes.
                </p>
              </div>
              {mfaError && <div className="error-text">{mfaError}</div>}
              <button className="btn btn-primary btn-block" onClick={onMfaSubmit} disabled={mfaBusy || !mfaCode.trim()}>
                {mfaBusy ? 'Verifying…' : 'Verify & sign in'}
              </button>
              <button
                className="btn btn-link btn-block"
                onClick={() => { setMfaToken(''); setMfaCode(''); setMfaError(''); }}
              >
                ← Back to sign in
              </button>
            </>
          ) : !ssoMode ? (
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
