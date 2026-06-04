import { useEffect, useState, type CSSProperties } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getBranding, updateBranding } from '../../api/branding';
import type { OrgBranding } from '../../types';
import { useAuth } from '../../context/AuthContext';
import './Branding.css';

// Preset primary / accent colour pairs.
const SWATCHES: { c: string; c2: string }[] = [
  { c: '#0a7b7b', c2: '#12a3a3' }, // teal (default)
  { c: '#1e40af', c2: '#3b82f6' }, // blue
  { c: '#166534', c2: '#16a34a' }, // green
  { c: '#6d28d9', c2: '#8b5cf6' }, // purple
  { c: '#b45309', c2: '#f59e0b' }, // amber
  { c: '#9d174d', c2: '#db2777' }, // magenta
  { c: '#0d3b4a', c2: '#1e6e7e' }, // navy
];

export default function BrandingPage() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ['branding'], queryFn: getBranding });
  const [form, setForm] = useState<OrgBranding | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (!form) return <div className="page"><p className="muted">Loading…</p></div>;

  const set = (patch: Partial<OrgBranding>) => { setForm({ ...form, ...patch }); setSaved(false); };

  const save = async () => {
    setBusy(true);
    try {
      const res = await updateBranding(form);
      setForm(res);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  const previewStyle = { '--brand': form.primaryColor, '--brand-2': form.accentColor } as CSSProperties;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Branding</h1>
          <p>White-label what your members see — portal, WhatsApp and member card.</p>
        </div>
      </div>

      <div className="brand-split">
        {/* Form */}
        <div className="card card-pad">
          <div className="bf-group">
            <label className="bf-label">Display name</label>
            <input className="bf-input" value={form.displayName} maxLength={120}
              onChange={(e) => set({ displayName: e.target.value })} placeholder="e.g. AXA Mansard Health" />
          </div>

          <div className="bf-group">
            <label className="bf-label">Logo mark</label>
            <div className="logo-pick">
              <div className="logo-opt on" style={{ background: form.primaryColor }}>
                {(form.logoLetter || form.displayName.charAt(0) || 'M').toUpperCase()}
              </div>
              <input className="bf-input logo-letter" value={form.logoLetter} maxLength={2}
                onChange={(e) => set({ logoLetter: e.target.value })} placeholder="Letter(s)" />
              <span className="muted small">Shown on the member portal &amp; card.</span>
            </div>
          </div>

          <div className="bf-group">
            <label className="bf-label">Primary colour</label>
            <div className="swatches">
              {SWATCHES.map((s) => (
                <div
                  key={s.c}
                  className={`swatch ${form.primaryColor.toLowerCase() === s.c ? 'on' : ''}`}
                  style={{ background: `linear-gradient(135deg, ${s.c}, ${s.c2})` }}
                  onClick={() => set({ primaryColor: s.c, accentColor: s.c2 })}
                  title={s.c}
                />
              ))}
            </div>
          </div>

          <div className="bf-group">
            <label className="bf-label">Support contact</label>
            <input className="bf-input" value={form.supportContact} maxLength={160}
              onChange={(e) => set({ supportContact: e.target.value })} placeholder="e.g. support@axamansard.com" />
          </div>

          <div className="bf-group">
            <label className="bf-label">WhatsApp greeting</label>
            <textarea className="bf-input" rows={2} value={form.whatsappGreeting} maxLength={1000}
              onChange={(e) => set({ whatsappGreeting: e.target.value })}
              placeholder="Welcome to AXA Mansard Health on MobiCova…" />
          </div>

          <div className="brand-actions">
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <a className="btn btn-ghost" href="/member/login" target="_blank" rel="noreferrer">Preview as member</a>
            {saved && <span className="brand-saved">✓ Saved</span>}
          </div>
        </div>

        {/* Live preview */}
        <div className="brand-preview-wrap" style={previewStyle}>
          <div className="bp-tag"><span className="live" /> Live preview</div>
          <div className="bphone">
            <div className="bp-screen">
              <div className="bp-status"><span>9:41</span><span>●●●</span></div>
              <div className="bp-head">
                <div className="bp-logo">{(form.logoLetter || form.displayName.charAt(0) || 'M').toUpperCase()}</div>
                <div className="bp-greet">
                  <small>Good morning</small>
                  <b>{form.displayName || 'Your brand'}</b>
                </div>
              </div>
              <div className="bp-body">
                <div className="bp-cover">
                  <small>Your cover</small>
                  <div className="pl">Essential Health Cover</div>
                  <span className="st">● Active · Paid</span>
                </div>
                <div className="bp-tiles">
                  <div className="bp-tile"><div className="bt-ic">✚</div><small>Care</small></div>
                  <div className="bp-tile"><div className="bt-ic">▦</div><small>Claims</small></div>
                  <div className="bp-tile"><div className="bt-ic">◎</div><small>Cover</small></div>
                </div>
                <div className="bp-btn">＋ Submit a claim</div>
                <div className="bp-foot">
                  {form.supportContact ? <>Support · <b>{form.supportContact}</b></> : <>Powered by <b>{form.displayName || 'MobiCova'}</b></>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
