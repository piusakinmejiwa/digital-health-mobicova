import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useProviderAuth } from '../../context/ProviderAuthContext';
import { PROVIDER_ORG_KEY } from '../../api/providerClient';
import { providerLogoutAllDevices } from '../../api/provider';
import BrandLogo from '../common/BrandLogo';
import '../../pages/provider/Provider.css';

// Chrome for the clinician / pharmacist portal. A focused top bar — the role
// determines which single workspace (consults vs dispensary) they land in.
export default function ProviderShell() {
  const { provider, logout } = useProviderAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const orgs = provider?.organisations ?? [];
  const [activeOrg, setActiveOrg] = useState<string>(
    localStorage.getItem(PROVIDER_ORG_KEY) || provider?.activeOrgId || orgs[0]?.id || ''
  );

  // Switch which clinic/pharmacy the clinician is acting as; refetch all queues.
  const switchOrg = (id: string) => {
    setActiveOrg(id);
    if (id) localStorage.setItem(PROVIDER_ORG_KEY, id);
    else localStorage.removeItem(PROVIDER_ORG_KEY);
    qc.invalidateQueries();
  };

  const signOut = () => {
    localStorage.removeItem(PROVIDER_ORG_KEY);
    logout();
    navigate('/provider/login');
  };

  // Lost/shared device: revoke all sessions server-side, then drop this one.
  const signOutEverywhere = async () => {
    if (!confirm('Sign out of all devices? Every signed-in session for your account will be ended.')) return;
    try { await providerLogoutAllDevices(); } catch { /* best-effort; still drop local session */ }
    signOut();
  };

  const roleLabel = provider?.role === 'pharmacist' ? 'Pharmacy' : 'Clinician';

  return (
    <div className="prov-app">
      <header className="prov-topbar">
        <div className="prov-brand">
          <BrandLogo />
          <span className="prov-brand-role">{roleLabel} portal</span>
        </div>
        <div className="prov-account">
          {orgs.length > 1 && (
            <select
              className="prov-org-switch"
              value={activeOrg}
              onChange={(e) => switchOrg(e.target.value)}
              aria-label="Acting as organisation"
              title="Switch the clinic/pharmacy you are working as"
            >
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <div className="prov-who">
            <span className="prov-name">{provider?.fullName}</span>
            <span className="prov-partner">
              {orgs.length === 1 ? orgs[0].name : (provider?.partnerName || '')}
              {provider?.specialty ? ` · ${provider.specialty}` : ''}
            </span>
          </div>
          <button className="btn btn-link" onClick={signOut}>Sign out</button>
          <button className="btn btn-link" onClick={signOutEverywhere} title="Revoke every signed-in session for your account">All devices</button>
        </div>
      </header>
      <main className="prov-main">
        <Outlet />
      </main>
    </div>
  );
}
