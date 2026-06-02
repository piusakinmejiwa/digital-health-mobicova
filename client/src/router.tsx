import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import SsoCallbackPage from './pages/auth/SsoCallbackPage';
import SsoSettingsPage from './pages/settings/SsoSettingsPage';
import SecuritySettingsPage from './pages/settings/SecuritySettingsPage';
import DeveloperSettingsPage from './pages/settings/DeveloperSettingsPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import MembersListPage from './pages/members/MembersListPage';
import MemberCreatePage from './pages/members/MemberCreatePage';
import MemberDetailPage from './pages/members/MemberDetailPage';
import TelemedicinePage from './pages/telemedicine/TelemedicinePage';
import AssistantPage from './pages/assistant/AssistantPage';
import InsurancePage from './pages/insurance/InsurancePage';
import ClaimsPage from './pages/claims/ClaimsPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import PartnersPage from './pages/partners/PartnersPage';
import ChannelsPage from './pages/channels/ChannelsPage';
import AdminPage from './pages/admin/AdminPage';
import AdminRoute from './components/layout/AdminRoute';
import MemberShell from './components/member/MemberShell';
import MemberProtectedRoute from './components/member/MemberProtectedRoute';
import MemberLoginPage from './pages/member/MemberLoginPage';
import MemberHomePage from './pages/member/MemberHomePage';
import MemberClaimsPage from './pages/member/MemberClaimsPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/sso/callback', element: <SsoCallbackPage /> },

  // --- Member self-service portal (separate auth domain) ---
  { path: '/member/login', element: <MemberLoginPage /> },
  {
    path: '/member',
    element: (
      <MemberProtectedRoute>
        <MemberShell />
      </MemberProtectedRoute>
    ),
    children: [
      { index: true, element: <MemberHomePage /> },
      { path: 'claims', element: <MemberClaimsPage /> },
    ],
  },

  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'members', element: <MembersListPage /> },
      { path: 'members/new', element: <MemberCreatePage /> },
      { path: 'members/:id', element: <MemberDetailPage /> },
      { path: 'telemedicine', element: <TelemedicinePage /> },
      { path: 'assistant', element: <AssistantPage /> },
      { path: 'insurance', element: <InsurancePage /> },
      { path: 'claims', element: <ClaimsPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'channels', element: <ChannelsPage /> },
      { path: 'settings/sso', element: <SsoSettingsPage /> },
      { path: 'settings/security', element: <SecuritySettingsPage /> },
      { path: 'settings/developer', element: <DeveloperSettingsPage /> },
      { path: 'partners', element: <PartnersPage /> },
      { path: 'admin', element: <AdminRoute><AdminPage /></AdminRoute> },
    ],
  },
]);
