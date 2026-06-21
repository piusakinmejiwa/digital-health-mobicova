import { createBrowserRouter } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import MarketingPage from './pages/marketing/MarketingPage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ActivatePage from './pages/auth/ActivatePage';
import SsoCallbackPage from './pages/auth/SsoCallbackPage';
import SsoSettingsPage from './pages/settings/SsoSettingsPage';
import SecuritySettingsPage from './pages/settings/SecuritySettingsPage';
import DeveloperSettingsPage from './pages/settings/DeveloperSettingsPage';
import BillingPage from './pages/settings/BillingPage';
import BrandingPage from './pages/settings/BrandingPage';
import DocsPage from './pages/docs/DocsPage';
import InboxPage from './pages/inbox/InboxPage';
import DashboardHome from './pages/dashboard/DashboardHome';
import SupplyStaffPage from './pages/supply/SupplyStaffPage';
import ActivityPage from './pages/activity/ActivityPage';
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
import MemberCarePage from './pages/member/MemberCarePage';
import MemberSymptomCheckPage from './pages/member/MemberSymptomCheckPage';
import MemberClaimsPage from './pages/member/MemberClaimsPage';
import MemberProfilePage from './pages/member/MemberProfilePage';
import ProviderShell from './components/provider/ProviderShell';
import ProviderProtectedRoute from './components/provider/ProviderProtectedRoute';
import ProviderLoginPage from './pages/provider/ProviderLoginPage';
import ProviderHome from './pages/provider/ProviderHome';
import ShapePage from './pages/feedback/ShapePage';
import ProspectFeedbackPage from './pages/admin/ProspectFeedbackPage';
import BuddyPage from './pages/buddy/BuddyPage';
import { PrivacyPage, CookiePolicyPage, AiPolicyPage } from './pages/legal/LegalPages';
import AskPage from './pages/ask/AskPage';
import BlogIndexPage from './pages/blog/BlogIndexPage';
import BlogPostPage from './pages/blog/BlogPostPage';
import HealthTipsPage from './pages/healthtips/HealthTipsPage';
import ContentPage from './pages/content/ContentPage';

export const router = createBrowserRouter([
  // Public marketing & pricing site (pre-login landing).
  { path: '/', element: <MarketingPage /> },

  // Public "Help shape MobiCova" discovery + feature-priority capture.
  { path: '/shape', element: <ShapePage /> },

  // Public free AI Health Buddy (grounded, cited basic health info).
  { path: '/buddy', element: <BuddyPage /> },

  // Public MobiCova Assistant (product/site Q&A; multilingual; hands off health to /buddy).
  { path: '/ask', element: <AskPage /> },

  // Public blog (SEO).
  { path: '/blog', element: <BlogIndexPage /> },
  { path: '/blog/:slug', element: <BlogPostPage /> },

  // Free public service: Daily Health Tips registration (+ ?token= unsubscribe).
  { path: '/health-tips', element: <HealthTipsPage /> },

  // Public company / platform / developer content pages.
  { path: '/about', element: <ContentPage slug="about" /> },
  { path: '/partners', element: <ContentPage slug="partners" /> },
  { path: '/careers', element: <ContentPage slug="careers" /> },
  { path: '/contact', element: <ContentPage slug="contact" /> },
  { path: '/telemedicine', element: <ContentPage slug="telemedicine" /> },
  { path: '/insurance', element: <ContentPage slug="insurance" /> },
  { path: '/channels', element: <ContentPage slug="channels" /> },
  { path: '/developers', element: <ContentPage slug="developers" /> },
  { path: '/webhooks', element: <ContentPage slug="webhooks" /> },
  { path: '/pricing', element: <ContentPage slug="pricing" /> },
  { path: '/security', element: <ContentPage slug="security" /> },

  // Public legal / policy pages.
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/cookies', element: <CookiePolicyPage /> },
  { path: '/ai', element: <AiPolicyPage /> },

  { path: '/login', element: <LoginPage /> },
  // Branded per-organisation login (themed to the org's white-label branding).
  { path: '/o/:slug/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/activate', element: <ActivatePage /> },
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
      { path: 'care', element: <MemberCarePage /> },
      { path: 'care/symptom-check', element: <MemberSymptomCheckPage /> },
      { path: 'claims', element: <MemberClaimsPage /> },
      { path: 'profile', element: <MemberProfilePage /> },
    ],
  },

  // --- Provider portal (clinician / pharmacist — separate auth domain) ---
  { path: '/provider/login', element: <ProviderLoginPage /> },
  {
    path: '/provider',
    element: (
      <ProviderProtectedRoute>
        <ProviderShell />
      </ProviderProtectedRoute>
    ),
    children: [
      { index: true, element: <ProviderHome /> },
    ],
  },

  {
    // Pathless layout route: the authenticated dashboard app. Child paths
    // resolve at the root (e.g. /dashboard), while '/' itself is the public
    // marketing page above.
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <DashboardHome /> },
      { path: 'staff', element: <SupplyStaffPage /> },
      { path: 'activity', element: <ActivityPage /> },
      { path: 'inbox', element: <InboxPage /> },
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
      { path: 'settings/billing', element: <BillingPage /> },
      { path: 'settings/branding', element: <BrandingPage /> },
      { path: 'docs', element: <DocsPage /> },
      { path: 'partners', element: <PartnersPage /> },
      { path: 'admin', element: <AdminRoute><AdminPage /></AdminRoute> },
      { path: 'admin/feedback', element: <AdminRoute><ProspectFeedbackPage /></AdminRoute> },
    ],
  },
]);
