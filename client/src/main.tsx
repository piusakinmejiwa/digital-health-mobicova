import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import './i18n'; // initialise i18next (English source + Pidgin) before render
import CookieConsent from './components/common/CookieConsent';
import { AuthProvider } from './context/AuthContext';
import { MemberAuthProvider } from './context/MemberAuthContext';
import { ProviderAuthProvider } from './context/ProviderAuthContext';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemberAuthProvider>
          <ProviderAuthProvider>
            <RouterProvider router={router} />
            <CookieConsent />
          </ProviderAuthProvider>
        </MemberAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
