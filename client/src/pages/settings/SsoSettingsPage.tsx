import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { getMySso, updateMySso } from '../../api/sso';
import type { SsoConfigInput } from '../../api/sso';
import { useAuth } from '../../context/AuthContext';
import SsoConfigEditor from '../../components/sso/SsoConfigEditor';

// Org-admin self-service: configure SAML single sign-on for your own
// organisation. Restricted to admins (managers/analysts can't reach the
// endpoint either — the server enforces it too).
export default function SsoSettingsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['my-sso'], queryFn: getMySso });

  if (user && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const save = (input: SsoConfigInput) => updateMySso(input);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Single sign-on</h1>
          <p>Let your team sign in to MobiCova with your company identity provider (SAML 2.0).</p>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 760 }}>
        {isLoading ? (
          <p className="muted">Loading…</p>
        ) : (
          <SsoConfigEditor config={data ?? null} onSave={save} />
        )}
      </div>
    </div>
  );
}
