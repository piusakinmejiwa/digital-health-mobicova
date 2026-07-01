import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestMemberOtp, verifyMemberOtp } from '../../api/member';
import { useMemberAuth } from '../../context/MemberAuthContext';
import BrandLogo from '../../components/common/BrandLogo';
import './Member.css';

// Passwordless sign-in: enter phone/email → receive a code → verify. In dev/demo
// (no SMS gateway) the API returns the code and we show it inline so the flow is
// testable end-to-end.
export default function MemberLoginPage() {
  const { login } = useMemberAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<'identify' | 'verify'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const id = identifier.trim();
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await requestMemberOtp(id);
      if (res.devCode) {
        setDevCode(res.devCode);
        setCode(res.devCode); // pre-fill for demo convenience
        setHint('Demo mode: no SMS gateway configured, so your code is shown below.');
      } else if (res.delivered) {
        setHint(`We sent a code to ${res.destinationHint || 'your contact'}.`);
      } else {
        setHint('If that contact matches a member, a code is on its way.');
      }
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send a code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await verifyMemberOtp(identifier.trim(), code.trim());
      login(res.token, res.member);
      navigate('/member');
    } catch (err: any) {
      setError(err.response?.data?.error || 'That code is not valid.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="member-auth-wrap">
      <div className="member-auth-card">
        <div className="member-auth-brand">
          <BrandLogo chip />
          <span className="member-auth-sub">Member portal</span>
        </div>

        {step === 'identify' ? (
          <>
            <h2>Sign in</h2>
            <p className="muted">Enter the phone number or email your provider has on file. We’ll send you a one-time code.</p>
            <div className="form-group">
              <label>Phone or email</label>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 08012345678 or you@email.com"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') sendCode(); }}
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary btn-block" onClick={sendCode} disabled={busy || !identifier.trim()}>
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <h2>Enter your code</h2>
            {hint && <p className="muted">{hint}</p>}
            {devCode && <div className="member-devcode">Code: <strong>{devCode}</strong></div>}
            <div className="form-group">
              <label>6-digit code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') verify(); }}
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary btn-block" onClick={verify} disabled={busy || !code.trim()}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button className="btn btn-link btn-block" onClick={sendCode} disabled={busy}>
              Didn’t get it? Resend code
            </button>
            <button
              className="btn btn-link btn-block"
              onClick={() => { setStep('identify'); setCode(''); setDevCode(''); setError(''); setHint(''); }}
            >
              ← Use a different number or email
            </button>
          </>
        )}
      </div>
    </div>
  );
}
