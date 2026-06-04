// Shared index for the ⌘K command palette and the contextual help widget.
// Everything points at REAL routes that exist in the app today; as later phases
// add pages (Docs, Inbox, Billing…), extend these lists.

export interface Command {
  group: 'Navigate' | 'Actions' | 'Docs';
  icon: string;
  label: string;
  href: string;
  keywords?: string;
  adminOnly?: boolean;        // org admin role
  platformAdminOnly?: boolean; // platform admin
}

export const COMMANDS: Command[] = [
  // Navigate
  { group: 'Navigate', icon: '◰', label: 'Dashboard', href: '/dashboard' },
  { group: 'Navigate', icon: '⊞', label: 'Inbox', href: '/inbox', keywords: 'action centre tasks' },
  { group: 'Navigate', icon: '⚇', label: 'Members', href: '/members' },
  { group: 'Navigate', icon: '✚', label: 'Telemedicine', href: '/telemedicine' },
  { group: 'Navigate', icon: '✦', label: 'AI Health Assistant', href: '/assistant', keywords: 'triage symptom' },
  { group: 'Navigate', icon: '◎', label: 'Insurance', href: '/insurance', keywords: 'plans enrolment cover' },
  { group: 'Navigate', icon: '▦', label: 'Claims', href: '/claims' },
  { group: 'Navigate', icon: '▤', label: 'Analytics & reporting', href: '/analytics', keywords: 'report kpi' },
  { group: 'Navigate', icon: '☷', label: 'WhatsApp & USSD', href: '/channels', keywords: 'intake join code' },
  { group: 'Navigate', icon: '⌬', label: 'Partner Ecosystem', href: '/partners' },
  { group: 'Navigate', icon: '₦', label: 'Billing & plan', href: '/settings/billing', keywords: 'subscription invoice usage upgrade', adminOnly: true },
  { group: 'Navigate', icon: '⛨', label: 'Security', href: '/settings/security', keywords: '2fa two factor mfa' },
  { group: 'Navigate', icon: '⚷', label: 'Single sign-on', href: '/settings/sso', keywords: 'saml sso', adminOnly: true },
  { group: 'Navigate', icon: '◑', label: 'Branding', href: '/settings/branding', keywords: 'white label logo colour brand', adminOnly: true },
  { group: 'Navigate', icon: '⧉', label: 'API & webhooks', href: '/settings/developer', keywords: 'developer api key webhook', adminOnly: true },
  { group: 'Navigate', icon: '⚙', label: 'Admin Console', href: '/admin', keywords: 'organisations users plans partners audit', platformAdminOnly: true },

  // Actions
  { group: 'Actions', icon: '＋', label: 'Add a member', href: '/members/new' },
  { group: 'Actions', icon: '⬆', label: 'Import members (CSV)', href: '/members', keywords: 'bulk upload' },
  { group: 'Actions', icon: '▦', label: 'Log a claim', href: '/claims' },
  { group: 'Actions', icon: '⬇', label: 'Open analytics & export', href: '/analytics', keywords: 'csv export report' },
  { group: 'Actions', icon: '⛨', label: 'Set up two-factor authentication', href: '/settings/security', keywords: '2fa mfa' },
  { group: 'Actions', icon: '⧉', label: 'Create an API key', href: '/settings/developer', adminOnly: true },

  // Docs
  { group: 'Docs', icon: '▤', label: 'Quick start', href: '/docs?a=quickstart' },
  { group: 'Docs', icon: '▤', label: 'Adding members', href: '/docs?a=members' },
  { group: 'Docs', icon: '▤', label: 'Plans & enrolment', href: '/docs?a=plans' },
  { group: 'Docs', icon: '▤', label: 'WhatsApp & USSD intake', href: '/docs?a=whatsapp' },
  { group: 'Docs', icon: '▤', label: 'API authentication', href: '/docs?a=auth' },
  { group: 'Docs', icon: '▤', label: 'Webhooks', href: '/docs?a=webhooks' },
];

export interface HelpItem { label: string; href: string; }
export interface HelpContent { title: string; sub: string; items: HelpItem[]; }

// Page-contextual suggestions, keyed by the leading path segment.
const HELP: Record<string, HelpContent> = {
  dashboard: { title: 'Help · Dashboard', sub: 'Getting set up', items: [
    { label: 'Add your first member', href: '/members/new' },
    { label: 'Import a member CSV', href: '/members' },
    { label: 'Create a webhook', href: '/settings/developer' },
  ]},
  members: { title: 'Help · Members', sub: 'Onboarding members', items: [
    { label: 'Add a member', href: '/members/new' },
    { label: 'Bulk-import a CSV', href: '/members' },
    { label: 'Enrol over WhatsApp & USSD', href: '/channels' },
  ]},
  claims: { title: 'Help · Claims', sub: 'Working the queue', items: [
    { label: 'Log a claim', href: '/claims' },
    { label: 'See analytics', href: '/analytics' },
  ]},
  analytics: { title: 'Help · Analytics', sub: 'Reporting', items: [
    { label: 'Export a report (CSV)', href: '/analytics' },
  ]},
  insurance: { title: 'Help · Insurance', sub: 'Plans & enrolment', items: [
    { label: 'Enrol a member', href: '/insurance' },
    { label: 'Review claims', href: '/claims' },
  ]},
  channels: { title: 'Help · WhatsApp & USSD', sub: 'Channel intake', items: [
    { label: 'Try the simulators', href: '/channels' },
    { label: 'Import members instead', href: '/members' },
  ]},
  settings: { title: 'Help · Settings', sub: 'Account & developers', items: [
    { label: 'Set up two-factor auth', href: '/settings/security' },
    { label: 'Manage API & webhooks', href: '/settings/developer' },
  ]},
};

const DEFAULT_HELP: HelpContent = {
  title: 'Help', sub: 'Suggested for you', items: [
    { label: 'Go to your Dashboard', href: '/dashboard' },
    { label: 'Add a member', href: '/members/new' },
  ],
};

export function helpForPath(pathname: string): HelpContent {
  const seg = pathname.split('/').filter(Boolean)[0] || 'dashboard';
  return HELP[seg] || DEFAULT_HELP;
}
