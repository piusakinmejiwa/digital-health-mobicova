// Integrations directory content. "available" = live in the platform today;
// "soon" = genuinely on the roadmap (not built). Keep this honest — don't list a
// connector as available unless it actually works.

export interface Integration {
  name: string;
  category: string;
  blurb: string;
  status: 'available' | 'soon';
  href?: string;   // where to set it up / learn more (available only)
}

export const INTEGRATIONS: Integration[] = [
  // Developer
  { name: 'REST API', category: 'Developer', status: 'available', href: '/developers/api',
    blurb: 'Programmatic access to members, enrolments and claims with scoped API keys.' },
  { name: 'Webhooks', category: 'Developer', status: 'available', href: '/webhooks',
    blurb: 'Signed, real-time event delivery to your own systems.' },
  // Identity & security
  { name: 'SAML Single Sign-On', category: 'Identity & security', status: 'available', href: '/trust',
    blurb: 'Enterprise SSO so your team signs in with your identity provider.' },
  // Payments
  { name: 'Paystack', category: 'Payments', status: 'available',
    blurb: 'Card and bank payments for premiums (Nigeria).' },
  { name: 'Stripe', category: 'Payments', status: 'available',
    blurb: 'International card payments.' },
  // Clinical & care
  { name: 'Daily.co', category: 'Clinical', status: 'available',
    blurb: 'Secure live video for telemedicine consultations.' },
  { name: 'PharmaRun', category: 'Clinical', status: 'available',
    blurb: 'Pharmacy fulfilment and medication delivery (when enabled).' },
  // Communications
  { name: "Africa's Talking", category: 'Communications', status: 'available',
    blurb: 'SMS, USSD and voice across Nigeria.' },
  { name: 'WhatsApp', category: 'Communications', status: 'available',
    blurb: 'Member enrolment and messaging over WhatsApp.' },
  { name: 'Resend', category: 'Communications', status: 'available',
    blurb: 'Transactional emails, notifications and scheduled reports.' },

  { name: 'Slack', category: 'Communications', status: 'available', href: '/settings/notifications',
    blurb: 'Post operational notifications (no member data) to your team’s Slack channel.' },

  // Coming soon (roadmap, not built)
  { name: 'Microsoft Teams', category: 'Communications', status: 'soon',
    blurb: 'Surface alerts and approvals inside Teams.' },
  { name: 'Google / Outlook Calendar', category: 'Productivity', status: 'soon',
    blurb: 'Sync consultation bookings to your calendar.' },
  { name: 'Zapier', category: 'Productivity', status: 'soon',
    blurb: 'Connect MobiCova to thousands of apps, no code required.' },
  { name: 'HRIS / Payroll sync', category: 'Identity & security', status: 'soon',
    blurb: 'Auto-enrol and offboard employees from your HR system.' },
  { name: 'QuickBooks', category: 'Payments', status: 'soon',
    blurb: 'Export premium and commission data to your accounts.' },
];

export const AVAILABLE_COUNT = INTEGRATIONS.filter((i) => i.status === 'available').length;
