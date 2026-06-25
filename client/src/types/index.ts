export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager' | 'analyst';
  orgId: string;
  orgName: string;
  partnerType?: string;
  orgClass?: 'demand' | 'supply' | 'integration' | 'platform';
  planTier?: string;
  joinCode?: string;
  mfaEnabled?: boolean;
  isPlatformAdmin?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// A password login can either succeed outright or demand a second factor.
export interface LoginResult {
  token?: string;
  user?: User;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface MfaStatus {
  enabled: boolean;
  backupCodesRemaining: number;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface Member {
  id: string;
  org_id: string;
  membership_id?: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string | null;
  gender: string;
  channel: string;
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
  status: string;
  created_at: string;
  consultation_count?: number;
  enrolment_count?: number;
}

export interface MemberDetail extends Member {
  consultations: Consultation[];
  enrolments: Enrolment[];
  triageSessions: TriageSummary[];
  prescriptions: Prescription[];
}

export interface Partner {
  id: string;
  name: string;
  category: string;
  description: string;
  coverage: string;
  licence: string;
  status: string;
}

// Platform-admin views of tenant organisations and their dashboard users.
export interface Organisation {
  id: string;
  name: string;
  slug: string;
  type: string;
  country: string;
  plan_tier: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
  user_count: number;
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AdminUser {
  id: string;
  org_id: string;
  org_name: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_platform_admin: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  org_id: string | null;
  org_name: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

export interface Consultation {
  id: string;
  member_id: string;
  member_name?: string;
  partner_id: string | null;
  partner_name?: string;
  mode: string;
  channel: string;
  reason: string;
  scheduled_at: string | null;
  status: string;
  doctor_name: string;
  notes: string;
  diagnosis: string;
  created_at: string;
  prescriptions?: Prescription[];
}

export interface Prescription {
  id: string;
  consultation_id: string;
  member_id: string;
  medication: string;
  dosage: string;
  instructions: string;
  pharmacy_partner: string;
  fulfilment_status: string;
  fulfilment_method?: string;   // '' | pickup | delivery
  // External fulfilment (PharmaRun network): provider, their status, tracking link.
  fulfilment_provider?: string; // 'internal' | 'pharmarun'
  external_status?: string;
  tracking_url?: string;
  delivery_address?: string;
  courier_name?: string;
  tracking_ref?: string;
  ready_at?: string | null;
  dispatched_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface InsurancePlan {
  id: string;
  name: string;
  plan_type: string;
  underwriter: string;
  monthly_premium: string;
  currency: string;
  cover_amount: string;
  benefits: string[];
  description: string;
  commission_rate: string;
  is_active: boolean;
}

export interface Enrolment {
  id: string;
  member_id: string;
  member_name?: string;
  plan_id: string;
  plan_name: string;
  plan_type: string;
  monthly_premium: string;
  currency: string;
  underwriter: string;
  commission_rate?: string;
  status: string;
  payment_status: string;
  enrolled_at: string;
}

export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';

export interface Claim {
  id: string;
  org_id: string;
  member_id: string;
  member_name?: string;
  member_email?: string;
  member_phone?: string;
  enrolment_id: string | null;
  plan_id: string | null;
  plan_name?: string | null;
  underwriter?: string | null;
  reference: string;
  claim_type: string;
  provider_name: string;
  service_date: string | null;
  amount: string;
  currency: string;
  description: string;
  status: ClaimStatus;
  decision_note: string;
  decided_by: string | null;
  decided_by_name?: string | null;
  decided_at: string | null;
  submitted_via: string;
  document_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ClaimDocument {
  id: string;
  label: string;
  file_name: string;
  file_url: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}

export interface ClaimDetail extends Claim {
  documents: ClaimDocument[];
}

export interface ClaimsResponse {
  claims: Claim[];
  counts: { status: string; count: number }[];
  storageEnabled: boolean;
}

// --- Inbox / Action centre (Phase 3) ---
export interface InboxAction { label: string; href: string; }
export interface InboxItem {
  key: string;
  group: 'urgent' | 'review' | 'system';
  severity: 'crit' | 'urgent' | 'normal';
  icon: 'amber' | 'teal' | 'red' | 'blue';
  title: string;
  meta: string;
  actions: InboxAction[];
  createdAt: string;
  read: boolean;
}
export interface InboxDone { action: string; target_label: string | null; actor_email: string | null; created_at: string; }
export interface InboxData {
  items: InboxItem[];
  done: InboxDone[];
  counts: { urgent: number; review: number; system: number; doneToday: number };
  unread: number;
}

// --- Analytics query builder (Phase 3) ---
export interface AnalyticsQueryRow { label: string; value: number; }
export interface AnalyticsQueryResult {
  measure: string;
  dimension: string;
  money: boolean;
  rows: AnalyticsQueryRow[];
  total: number;
}
export interface AnalyticsMeasureOption { key: string; money: boolean; dimensions: string[]; }

// --- Billing & subscription (Phase 2) ---
export interface BillingTier {
  key: string;
  name: string;
  price: number | null;
  features: string[];
  limits: { members: number; webhooks: number; intake: number };
}

export interface BillingUsage {
  key: string;
  label: string;
  used: number;
  limit: number;
}

export interface BillingInvoice {
  reference: string;
  date: string;
  plan: string;
  amount: number;
  status: string;
}

export interface BillingAccount {
  plan: { key: string; name: string; price: number | null };
  renewsAt: string;
  paymentMethod: string;
  billingCurrency: string;
  usage: BillingUsage[];
  tiers: BillingTier[];
  recommendedTier: BillingTier | null;
  invoices: BillingInvoice[];
}

// --- Provider admin (Add a Doctor) ---
export interface AdminProvider {
  id: string;
  partner_id: string;
  partner_name?: string;
  partner_category?: string;
  full_name: string;
  email: string;
  role: 'doctor' | 'pharmacist';
  specialty: string;
  photo_url: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

// A doctor shown in the member "talk to a doctor" list.
export interface MemberDoctor {
  id: string;
  full_name: string;
  specialty: string;
  photo_url: string;
  partner_name: string;
}

// --- Provider portal (Q9) ---
export type ProviderRole = 'doctor' | 'pharmacist';

export interface ProviderOrg {
  id: string;
  name: string;
  type: string;
  is_primary: boolean;
}

export interface ProviderSession {
  id: string;
  fullName: string;
  email: string;
  role: ProviderRole;
  specialty: string;
  partnerName: string;
  partnerCategory: string;
  organisations?: ProviderOrg[];
  activeOrgId?: string | null;
}

export interface ProviderConsultation {
  id: string;
  org_id: string;
  org_name: string;
  member_id: string;
  member_name: string;
  gender: string;
  date_of_birth: string | null;
  allergies: string[];
  chronic_conditions: string[];
  mode: string;
  channel: string;
  reason: string;
  scheduled_at: string | null;
  status: string;
  doctor_name: string;
  notes: string;
  diagnosis: string;
  provider_id: string | null;
  created_at: string;
  updated_at: string;
  prescriptions?: Prescription[];
}

export interface ProviderConsultationsResponse {
  consultations: ProviderConsultation[];
  counts: { status: string; count: number }[];
}

export interface ProviderPrescription {
  id: string;
  consultation_id: string;
  member_id: string;
  member_name: string;
  medication: string;
  dosage: string;
  instructions: string;
  pharmacy_partner: string;
  fulfilment_status: string;
  fulfilment_method: string;   // '' | pickup | delivery
  delivery_address: string;
  courier_name: string;
  tracking_ref: string;
  dispensed_at: string | null;
  ready_at: string | null;
  dispatched_at: string | null;
  completed_at: string | null;
  created_at: string;
  diagnosis: string;
  doctor_name: string;
}

export interface ProviderPrescriptionsResponse {
  prescriptions: ProviderPrescription[];
  counts: { status: string; count: number }[];
}

// --- Public API + webhooks (Q8) ---
export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface NewApiKey extends ApiKey {
  key: string; // full key, shown once
}

export interface WebhookDeliverySummary {
  success: boolean;
  status_code: number | null;
  event: string;
  created_at: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  last_delivery?: WebhookDeliverySummary | null;
}

export interface NewWebhookEndpoint extends WebhookEndpoint {
  secret: string; // signing secret, shown once
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status_code: number | null;
  success: boolean;
  error: string | null;
  created_at: string;
}

// --- White-label branding (Phase 2) ---
export interface OrgBranding {
  displayName: string;
  logoLetter: string;
  primaryColor: string;
  accentColor: string;
  supportContact: string;
  whatsappGreeting: string;
}

// --- Member self-service portal (Q10) ---
export interface MemberSession {
  id: string;
  fullName: string;
  orgId: string;
}

export interface MemberProfile {
  id: string;
  membership_id?: string;
  full_name: string;
  phone: string;
  email: string;
  date_of_birth: string | null;
  gender: string;
  channel: string;
  blood_group: string;
  allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
  address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  created_at: string;
  org_name: string;
  partner_type: string;
  counts: { enrolments: number; consultations: number; claims: number };
  branding?: OrgBranding;
}

export interface MemberOverview {
  enrolments: Enrolment[];
  consultations: Consultation[];
  prescriptions: Prescription[];
  triageSessions: TriageSession[];
  // Which live-call channels are switched on server-side.
  capabilities?: { video: boolean; phoneCalls: boolean; recording: boolean };
}

export interface OtpRequestResult {
  sent: boolean;
  delivered?: boolean;
  channel?: string;
  destinationHint?: string;
  // Present only in dev/demo (no live delivery channel) — the code to enter.
  devCode?: string;
  notFound?: boolean;
}

export type TriageLevel = 'emergency' | 'urgent' | 'gp' | 'self_care' | 'info' | 'unknown';

export interface TriageMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TriageSession {
  id: string;
  org_id: string;
  member_id: string | null;
  member_name?: string;
  messages: TriageMessage[];
  triage_level: TriageLevel;
  recommendation: string;
  engine: string;
  created_at: string;
  updated_at: string;
}

export interface TriageSummary {
  id: string;
  member_id: string | null;
  member_name?: string;
  triage_level: TriageLevel;
  recommendation: string;
  engine: string;
  created_at: string;
}

export interface AnalyticsReport {
  summary: {
    members: number;
    activeMembers: number;
    consultations: number;
    completedConsultations: number;
    enrolments: number;
    paidEnrolments: number;
    triageSessions: number;
    monthlyPremium: number;
    monthlyCommission: number;
  };
  utilization: {
    consultationsPerMember: number;
    triagePerMember: number;
    enrolmentRate: number;
    activeRate: number;
  };
  trend: { month: string; members: number; consultations: number; enrolments: number }[];
  premiumByPlan: {
    planName: string; underwriter: string; enrolments: number; premium: number; commission: number;
  }[];
  byUnderwriter: { underwriter: string; enrolments: number; premium: number }[];
  consultationsByStatus: { status: string; count: number }[];
  consultationsByMode: { mode: string; count: number }[];
  triageByLevel: { triage_level: string; count: number }[];
  channelBreakdown: { channel: string; count: number }[];
}

// Per-tenant SAML SSO configuration as returned by /sso/config and
// /admin/organisations/:id/sso. `sp` holds the Service Provider coordinates a
// partner registers with their identity provider.
export interface SsoConfig {
  enabled: boolean;
  entryPoint: string;
  idpIssuer: string;
  idpCert: string;
  emailAttribute: string;
  sp: {
    entityId: string;
    acsUrl: string;
    loginUrl: string;
    metadataUrl: string;
  };
}

export interface OnboardingStep {
  key: string;
  title: string;
  sub: string;
  done: boolean;
  kicker: string;
  detailTitle: string;
  body: string;
  cta: string;
  ctaHref: string;
  perks: string[];
}

export interface Onboarding {
  dismissed: boolean;
  completed: number;
  total: number;
  activeIndex: number;
  allDone: boolean;
  steps: OnboardingStep[];
}

export interface DashboardData {
  onboarding: Onboarding;
  metrics: {
    members: number;
    consultations: number;
    enrolments: number;
    triageSessions: number;
    monthlyPremium: number;
    monthlyCommission: number;
  };
  milestones: {
    target10k: { label: string; current: number; target: number };
    target100k: { label: string; current: number; target: number };
  };
  channelBreakdown: { channel: string; count: number }[];
  triageBreakdown: { triage_level: string; count: number }[];
  recentConsultations: {
    id: string; status: string; mode: string; created_at: string; member_name: string;
  }[];
  recentEnrolments: {
    id: string; status: string; payment_status: string; enrolled_at: string;
    member_name: string; plan_name: string;
  }[];
}
