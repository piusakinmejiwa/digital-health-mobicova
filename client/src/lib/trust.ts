// Single source of truth for Trust & Security Centre content — shared by the
// public /trust page and the in-app tenant Compliance tab so they never drift.
//
// HONESTY RULE: every claim here must be true of the running platform. Formal
// certifications we do NOT hold (ISO 27001 / SOC 2) are listed as "roadmap",
// never as held. Confirm the bracketed [ ... ] contacts before launch.

export const DPA_VERSION = '2026-06';
export const SECURITY_CONTACT = '[security@mobicova.com]';

// Third parties that process data on our behalf, with purpose + primary region.
export interface SubProcessor { name: string; purpose: string; region: string; }
export const SUBPROCESSORS: SubProcessor[] = [
  { name: 'Supabase', purpose: 'Managed PostgreSQL database & private file storage', region: 'EU (London)' },
  { name: 'Render', purpose: 'Application hosting & compute', region: 'EU / US' },
  { name: 'Resend', purpose: 'Transactional & scheduled-report email', region: 'US / EU' },
  { name: "Africa's Talking", purpose: 'SMS, USSD & voice (Nigeria)', region: 'Nigeria' },
  { name: 'Daily.co', purpose: 'Telemedicine video consultations', region: 'Global' },
  { name: 'Anthropic', purpose: 'AI for the Health Buddy & triage assistance', region: 'US' },
  { name: 'Paystack', purpose: 'Card & bank payments (Nigeria)', region: 'Nigeria' },
  { name: 'Stripe', purpose: 'International card payments', region: 'US / EU' },
  { name: 'Google Maps Platform', purpose: 'Address geocoding for nearest-pharmacy routing', region: 'Global' },
  { name: 'PharmaRun', purpose: 'Pharmacy fulfilment & delivery (when enabled)', region: 'Nigeria' },
];

// Technical & organisational measures actually implemented in the platform.
export interface Measure { title: string; detail: string; icon: string; }
export const SECURITY_MEASURES: Measure[] = [
  { icon: '🔒', title: 'Encryption everywhere', detail: 'TLS 1.2+ in transit; database and document storage encrypted at rest.' },
  { icon: '👥', title: 'Role-based access control', detail: 'Admin / manager / analyst roles, with platform staff separated from tenant admins.' },
  { icon: '🏢', title: 'Tenant isolation', detail: 'Every record is scoped to its organisation; one client can never see another’s data.' },
  { icon: '🔑', title: 'SSO & 2FA', detail: 'SAML 2.0 single sign-on for enterprise tenants and TOTP two-factor for any account.' },
  { icon: '📄', title: 'Private documents', detail: 'Uploaded documents live in a private store, reachable only via short-lived signed links.' },
  { icon: '📝', title: 'Audit logging', detail: 'Administrative and data-changing actions are recorded with who, what and when.' },
  { icon: '🔗', title: 'Secure integrations', detail: 'Signed, verifiable webhooks and scoped API keys for partner integrations.' },
  { icon: '🍪', title: 'Data minimisation', detail: 'Only essential functional storage in the browser — no advertising or tracking cookies.' },
];

// Compliance posture — what's TRUE today. `status` drives the badge colour.
export interface ComplianceItem { title: string; detail: string; status: 'active' | 'available' | 'roadmap'; }
export const COMPLIANCE: ComplianceItem[] = [
  { title: 'NDPR / Nigeria Data Protection Act', status: 'active',
    detail: 'Aligned with NDPA/NDPR: a lawful basis for processing, explicit consent for sensitive health data, data-subject rights, and a clear route to complain to the NDPC.' },
  { title: 'GDPR-aligned practices', status: 'active',
    detail: 'We apply GDPR-equivalent controls — a Data Processing Agreement, sub-processor transparency, and safeguards for cross-border transfers.' },
  { title: 'Data Processing Agreement (DPA)', status: 'available',
    detail: 'We sign a DPA with every B2B client setting out roles, security measures and sub-processors. Available on request.' },
  { title: 'Independent certification (ISO 27001 / SOC 2)', status: 'roadmap',
    detail: 'We follow these frameworks’ practices but do not yet hold formal certification. Pursuing it is on our roadmap.' },
];

export const COMPLIANCE_BADGE: Record<ComplianceItem['status'], { label: string; cls: string }> = {
  active: { label: 'In place', cls: 'badge-green' },
  available: { label: 'On request', cls: 'badge-blue' },
  roadmap: { label: 'Roadmap', cls: 'badge-gray' },
};
