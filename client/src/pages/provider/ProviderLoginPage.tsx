import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { providerLogin } from '../../api/provider';
import { useProviderAuth } from '../../context/ProviderAuthContext';
import './Provider.css';

export default function ProviderLoginPage() {
  const { login } = useProviderAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await providerLogin(email.trim(), password);
      login(res.token, res.provider);
      navigate('/provider');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="prov-auth-wrap">
      <div className="prov-auth-card">
        <div className="prov-auth-brand">
          <span className="logo-mark">M</span>
          <div>
            <strong>MobiCova</strong>
            <span className="prov-auth-sub">Provider portal</span>
          </div>
        </div>
        <h2>Provider sign in</h2>
        <p className="muted">For clinicians and pharmacists at MobiCova partner organisations.</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Work email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
