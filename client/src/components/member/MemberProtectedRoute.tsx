import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useMemberAuth } from '../../context/MemberAuthContext';

export default function MemberProtectedRoute({ children }: { children: ReactNode }) {
  const { member, loading } = useMemberAuth();

  if (loading) {
    return <div className="loading-screen">Loading…</div>;
  }
  if (!member) {
    return <Navigate to="/member/login" replace />;
  }
  return <>{children}</>;
}
