import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMfaStatus, startMfaSetup, enableMfa, disableMfa } from '../../api/auth';
import type { MfaSetup } from '../../types';
import './Security.css';

// Self-service two-factor authentication. Available to every signed-in user
// (any role) — MFA protects the account, not the tenant's data.
export default function SecuritySettingsPage() {
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery({ queryKey: ['mfa-status'], queryFn: getMfaStatus });

  // Setup wizard state (only used while enrolling a new authenticator).
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Disable flow state.
  const [showDisable, setShowDisable] = useState(false);
  const [password, setPassword] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['mfa-status'] });

  const beginSetup = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await startMfaSetup();
      setSetup(data);
      setCode('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not start setup.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async () => {
    if (!code.trim()) return;
    setError('');
    setBusy(true);
    try {
      const res = await enableMfa(code.trim());
      setBackupCodes(res.backupCodes);
      setSetup(null);
      setCode('');
      refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || 'That code is not valid.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (!password) return;
    setError('');
    setBusy(true);
    try {
      await disableMfa(password);
      setShowDisable(false);
      setPassword('');
      setBackupCodes(null);
      refresh();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not disable two-factor authentication.');
    } finally {
      setBusy(false);
    }
  };

  const copyBackup = () => {
    if (backupCodes) navigator.clipboard?.writeText(backupCodes.join('\n')).catch(() => {});
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Security</h1>
          <p>Add a second factor to protect your MobiCova account.</p>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 640 }}>
        <h2 className="sec-title">Two-factor authentication (2FA)</h2>
        <p className="muted">
          Use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…)
          to generate a 6-digit code at each sign-in.
        </p>

        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : backupCodes ? (
          // Shown once, immediately after enabling.
          <div className="sec-block">
            <div className="badge badge-green">2FA enabled</div>
            <h3 className="sec-subtitle">Save your backup codes</h3>
            <p className="muted">
              Each code works once if you lose your authenticator. Store them somewhere safe — they
              won’t be shown again.
            </p>
            <ul className="backup-codes">
              {backupCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div className="sec-actions">
              <button className="btn btn-secondary" onClick={copyBackup}>Copy codes</button>
              <button className="btn btn-primary" onClick={() => setBackupCodes(null)}>Done</button>
            </div>
          </div>
        ) : status?.enabled ? (
          // Steady state: enabled.
          <div className="sec-block">
            <div className="badge badge-green">2FA is on</div>
            <p className="muted" style={{ marginTop: 12 }}>
              {status.backupCodesRemaining} backup code{status.backupCodesRemaining === 1 ? '' : 's'} remaining.
            </p>
            {!showDisable ? (
              <button className="btn btn-danger" onClick={() => { setShowDisable(true); setError(''); }}>
                Turn off 2FA
              </button>
            ) : (
              <div className="sec-inline">
                <label>Confirm your password to turn off 2FA</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Current password"
                  autoFocus
                />
                {error && <div className="error-text">{error}</div>}
                <div className="sec-actions">
                  <button className="btn btn-link" onClick={() => { setShowDisable(false); setPassword(''); setError(''); }}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={confirmDisable} disabled={busy || !password}>
                    {busy ? 'Turning off…' : 'Turn off 2FA'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : setup ? (
          // Setup wizard: scan + verify.
          <div className="sec-block">
            <h3 className="sec-subtitle">1. Scan this QR code</h3>
            <img src={setup.qrDataUrl} alt="2FA QR code" className="sec-qr" />
            <p className="muted small">
              Can’t scan? Enter this key manually: <code className="sec-secret">{setup.secret}</code>
            </p>
            <h3 className="sec-subtitle">2. Enter the 6-digit code</h3>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              onKeyDown={(e) => { if (e.key === 'Enter') confirmEnable(); }}
            />
            {error && <div className="error-text">{error}</div>}
            <div className="sec-actions">
              <button className="btn btn-link" onClick={() => { setSetup(null); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmEnable} disabled={busy || !code.trim()}>
                {busy ? 'Verifying…' : 'Verify & enable'}
              </button>
            </div>
          </div>
        ) : (
          // Steady state: disabled.
          <div className="sec-block">
            <div className="badge badge-gray">2FA is off</div>
            {error && <div className="error-text">{error}</div>}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-primary" onClick={beginSetup} disabled={busy}>
                {busy ? 'Starting…' : 'Set up 2FA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
