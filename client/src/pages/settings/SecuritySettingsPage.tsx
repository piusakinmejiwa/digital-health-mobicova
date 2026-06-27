import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMfaStatus, startMfaSetup, enableMfa, disableMfa,
  listSessions, revokeSession, revokeOtherSessions, type UserSession } from '../../api/auth';
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

      <ActiveSessions />
    </div>
  );
}

// Active devices/sessions — sign out a single device or everywhere else.
function ActiveSessions() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['sessions'], queryFn: listSessions });
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['sessions'] });

  const fmt = (s: string) => new Date(s).toLocaleString('en-GB');
  const device = (ua: string) => {
    if (!ua) return 'Unknown device';
    const browser = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS|Macintosh/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
    return `${browser}${os ? ` · ${os}` : ''}`;
  };

  const revokeOne = async (s: UserSession) => {
    if (!confirm('Sign out this device?')) return;
    setBusy(true);
    try { await revokeSession(s.id); refresh(); } finally { setBusy(false); }
  };
  const revokeOthers = async () => {
    if (!confirm('Sign out of all other devices? You’ll stay signed in here.')) return;
    setBusy(true);
    try { await revokeOtherSessions(); refresh(); } finally { setBusy(false); }
  };

  const sessions = data?.sessions || [];
  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="card card-pad" style={{ maxWidth: 640, marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>Active sessions</h2>
      <p className="muted small">Devices currently signed in to your account. If you don’t recognise one, sign it out.</p>
      {isLoading ? <p className="muted">Loading…</p> : sessions.length === 0 ? (
        <p className="muted small">No active sessions tracked yet — sign out and back in to start tracking this device.</p>
      ) : (
        <>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid #eef3f3' }}>
              <div>
                <div style={{ fontWeight: 600, color: '#11302e' }}>
                  {device(s.user_agent)} {s.current && <span className="badge badge-green" style={{ marginLeft: 6 }}>This device</span>}
                </div>
                <div className="muted small">{s.ip || 'IP unknown'} · last active {fmt(s.last_seen_at)}</div>
              </div>
              {!s.current && (
                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => revokeOne(s)}>Sign out</button>
              )}
            </div>
          ))}
          {others > 0 && (
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" disabled={busy} onClick={revokeOthers}>Sign out all other devices ({others})</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
