import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { MemberSession } from '../types';
import { getMemberMe } from '../api/member';
import { MEMBER_TOKEN_KEY } from '../api/memberClient';

interface MemberAuthContextType {
  member: MemberSession | null;
  token: string | null;
  loading: boolean;
  login: (token: string, member: MemberSession) => void;
  logout: () => void;
}

const MemberAuthContext = createContext<MemberAuthContextType | undefined>(undefined);

// Parallel to AuthContext, but for the member portal. Uses its own token key so
// a signed-in member and a signed-in partner staffer never collide.
export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<MemberSession | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem(MEMBER_TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getMemberMe()
        .then((m) => setMember({ id: m.id, fullName: m.full_name, orgId: '' }))
        .catch(() => {
          localStorage.removeItem(MEMBER_TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newMember: MemberSession) => {
    localStorage.setItem(MEMBER_TOKEN_KEY, newToken);
    setToken(newToken);
    setMember(newMember);
  };

  const logout = () => {
    localStorage.removeItem(MEMBER_TOKEN_KEY);
    setToken(null);
    setMember(null);
  };

  return (
    <MemberAuthContext.Provider value={{ member, token, loading, login, logout }}>
      {children}
    </MemberAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMemberAuth() {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error('useMemberAuth must be used within MemberAuthProvider');
  return ctx;
}
