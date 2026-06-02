import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useProviderAuth } from '../../context/ProviderAuthContext';

export default function ProviderProtectedRoute({ children }: { children: ReactNode }) {
  const { provider, loading } = useProviderAuth();
  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!provider) return <Navigate to="/provider/login" replace />;
  return <>{children}</>;
}
