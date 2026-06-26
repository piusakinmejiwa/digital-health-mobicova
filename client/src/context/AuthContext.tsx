import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { getMe } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  // True when the signed-in user may mutate their org's data (admin/manager).
  // Analysts are read-only. Mirrors the server's requireWrite guard so the UI
  // can hide actions that would be rejected — the server stays the boundary.
  canWrite: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  // Platform-admin "View as org": swap to a tenant-scoped token (keeping the
  // platform token in reserve), and restore it on exit.
  impersonate: (token: string) => void;
  stopImpersonating: () => void;
}

const PLATFORM_TOKEN_KEY = 'mobicova_platform_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('mobicova_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('mobicova_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('mobicova_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('mobicova_token');
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  // Enter a tenant: stash the current (platform) token, switch to the tenant one.
  // Changing the token triggers the effect above to refetch /me as that tenant.
  const impersonate = (tenantToken: string) => {
    const current = localStorage.getItem('mobicova_token');
    if (current) localStorage.setItem(PLATFORM_TOKEN_KEY, current);
    localStorage.setItem('mobicova_token', tenantToken);
    setToken(tenantToken);
  };

  const stopImpersonating = () => {
    const platform = localStorage.getItem(PLATFORM_TOKEN_KEY);
    if (!platform) return;
    localStorage.setItem('mobicova_token', platform);
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    setToken(platform);
  };

  const canWrite = user?.role === 'admin' || user?.role === 'manager';

  return (
    <AuthContext.Provider value={{ user, token, loading, canWrite, login, logout, impersonate, stopImpersonating }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
