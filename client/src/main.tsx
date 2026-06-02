import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { MemberAuthProvider } from './context/MemberAuthContext';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemberAuthProvider>
          <RouterProvider router={router} />
        </MemberAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
