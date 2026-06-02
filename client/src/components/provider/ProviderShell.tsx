import { Outlet, useNavigate } from 'react-router-dom';
import { useProviderAuth } from '../../context/ProviderAuthContext';
import '../../pages/provider/Provider.css';

// Chrome for the clinician / pharmacist portal. A focused top bar — the role
// determines which single workspace (consults vs dispensary) they land in.
export default function ProviderShell() {
  const { provider, logout } = useProviderAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/provider/login');
  };

  const roleLabel = provider?.role === 'pharmacist' ? 'Pharmacy' : 'Clinician';

  return (
    <div className="prov-app">
      <header className="prov-topbar">
        <div className="prov-brand">
          <span className="logo-mark">M</span>
          <div className="prov-brand-text">
            <strong>MobiCova</strong>
            <span>{roleLabel} portal</span>
          </div>
        </div>
        <div className="prov-account">
          <div className="prov-who">
            <span className="prov-name">{provider?.fullName}</span>
            <span className="prov-partner">{provider?.partnerName}{provider?.specialty ? ` · ${provider.specialty}` : ''}</span>
          </div>
          <button className="btn btn-link" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="prov-main">
        <Outlet />
      </main>
    </div>
  );
}
