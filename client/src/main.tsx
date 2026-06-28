import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react';
import './sentry'; // initialise error tracking before anything else renders
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

// Friendly full-screen fallback if a render error escapes a page. Caught by the
// Sentry ErrorBoundary (which reports it when a DSN is configured).
function AppCrash() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center', color: '#1c2b2b' }}>
      <div style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: '#5e6e6e', marginBottom: 20 }}>
          We hit an unexpected error and our team has been notified. Please reload the page to continue.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: '#0a7b7b', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrash />}>
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
    </Sentry.ErrorBoundary>
  </StrictMode>
);
