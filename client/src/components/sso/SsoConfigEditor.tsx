import { useState, useEffect } from 'react';
import axios from 'axios';
import type { SsoConfig } from '../../types';
import type { SsoConfigInput } from '../../api/sso';
import './SsoConfigEditor.css';

function errMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || fallback;
  return fallback;
}

// One Service-Provider coordinate with a copy-to-clipboard button. These are the
// values a partner pastes into their IdP when registering the platform.
function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="sso-sp-field">
      <label>{label}</label>
      {hint && <p className="muted small">{hint}</p>}
      <div className="sso-copy">
        <code>{value}</code>
        <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

const EMPTY: SsoConfigInput = {
  enabled: false, entryPoint: '', idpIssuer: '', idpCert: '', emailAttribute: '',
};

// Shared, presentational SSO editor. The parent supplies the loaded config and a
// save function (org self-service vs platform-admin differ only in which
// endpoint they call), and we own the form state.
export default function SsoConfigEditor({
  config,
  onSave,
}: {
  config: SsoConfig | null;
  onSave: (input: SsoConfigInput) => Promise<SsoConfig>;
}) {
  const [form, setForm] = useState<SsoConfigInput>(EMPTY);
  const [sp, setSp] = useState<SsoConfig['sp'] | null>(config?.sp ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        enabled: config.enabled,
        entryPoint: config.entryPoint,
        idpIssuer: config.idpIssuer,
        idpCert: config.idpCert,
        emailAttribute: config.emailAttribute,
      });
      setSp(config.sp);
    }
  }, [config]);

  const set = <K extends keyof SsoConfigInput>(key: K, value: SsoConfigInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true); setError(''); setSaved(false);
    try {
      const updated = await onSave(form);
      setSp(updated.sp);
      setForm({
        enabled: updated.enabled,
        entryPoint: updated.entryPoint,
        idpIssuer: updated.idpIssuer,
        idpCert: updated.idpCert,
        emailAttribute: updated.emailAttribute,
      });
      setSaved(true);
    } catch (err) {
      setError(errMessage(err, 'Could not save the SSO configuration.'));
    } finally {
      setBusy(false);
    }
  };

  if (!config) return <p className="muted">Loading…</p>;

  return (
    <div className="sso-editor">
      {/* Step 1: give these to the IdP admin */}
      <section className="sso-block">
        <h4 className="sso-block-title">1 · Register MobiCova with your identity provider</h4>
        <p className="muted small">
          Add a new SAML application in your IdP (Okta, Azure AD, Google Workspace…) using these
          Service Provider details.
        </p>
        {sp && (
          <div className="sso-sp-grid">
            <CopyField label="SP Entity ID / Issuer" value={sp.entityId} />
            <CopyField label="ACS / Reply URL" value={sp.acsUrl} hint="Where the IdP posts its assertion." />
            <CopyField label="Metadata URL" value={sp.metadataUrl} hint="Some IdPs import config from this." />
            <CopyField label="Sign-in (SP-initiated) URL" value={sp.loginUrl} />
          </div>
        )}
      </section>

      {/* Step 2: capture the IdP details */}
      <section className="sso-block">
        <h4 className="sso-block-title">2 · Enter your identity provider details</h4>
        <div className="form-group">
          <label>IdP sign-in URL (entry point)</label>
          <input
            value={form.entryPoint}
            onChange={(e) => set('entryPoint', e.target.value)}
            placeholder="https://your-idp.example.com/sso/saml"
          />
        </div>
        <div className="form-group">
          <label>IdP issuer / entity ID <span className="muted small">(optional)</span></label>
          <input
            value={form.idpIssuer}
            onChange={(e) => set('idpIssuer', e.target.value)}
            placeholder="http://www.okta.com/exk..."
          />
        </div>
        <div className="form-group">
          <label>Email attribute <span className="muted small">(optional — blank uses the NameID)</span></label>
          <input
            value={form.emailAttribute}
            onChange={(e) => set('emailAttribute', e.target.value)}
            placeholder="e.g. email or http://schemas.xmlsoap.org/.../emailaddress"
          />
        </div>
        <div className="form-group">
          <label>IdP signing certificate (X.509, PEM)</label>
          <textarea
            className="sso-cert"
            rows={6}
            value={form.idpCert}
            onChange={(e) => set('idpCert', e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----&#10;MIID...&#10;-----END CERTIFICATE-----"
          />
        </div>
      </section>

      {/* Step 3: switch it on */}
      <section className="sso-block">
        <h4 className="sso-block-title">3 · Enable</h4>
        <label className="sso-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
          />
          <span>Enable single sign-on for this organisation</span>
        </label>
        <p className="muted small">
          Only users who already have a MobiCova account in this organisation can sign in via SSO —
          unknown emails are rejected (no automatic account creation).
        </p>
      </section>

      {error && <div className="notice notice-error">{error}</div>}
      {saved && <div className="notice notice-success">SSO configuration saved.</div>}

      <div className="modal-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save SSO settings'}
        </button>
      </div>
    </div>
  );
}
