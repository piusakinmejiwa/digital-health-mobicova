import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { ProviderSession } from '../types';
import { getProviderMe } from '../api/provider';
import { PROVIDER_TOKEN_KEY } from '../api/providerClient';

interface ProviderAuthContextType {
  provider: ProviderSession | null;
  token: string | null;
  loading: boolean;
  login: (token: string, provider: ProviderSession) => void;
  logout: () => void;
}

const ProviderAuthContext = createContext<ProviderAuthContextType | undefined>(undefined);

// Third auth domain (alongside staff + member), for clinicians and pharmacists.
export function ProviderAuthProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<ProviderSession | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem(PROVIDER_TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getProviderMe()
        .then(setProvider)
        .catch(() => {
          localStorage.removeItem(PROVIDER_TOKEN_KEY);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newProvider: ProviderSession) => {
    localStorage.setItem(PROVIDER_TOKEN_KEY, newToken);
    setToken(newToken);
    setProvider(newProvider);
  };

  const logout = () => {
    localStorage.removeItem(PROVIDER_TOKEN_KEY);
    setToken(null);
    setProvider(null);
  };

  return (
    <ProviderAuthContext.Provider value={{ provider, token, loading, login, logout }}>
      {children}
    </ProviderAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProviderAuth() {
  const ctx = useContext(ProviderAuthContext);
  if (!ctx) throw new Error('useProviderAuth must be used within ProviderAuthProvider');
  return ctx;
}
