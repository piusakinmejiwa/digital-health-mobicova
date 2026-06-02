export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'member';
  orgId: string;
  orgName: string;
  partnerType?: string;
  planTier?: string;
  joinCode?: string;
  isPlatformAdmin?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Member {
  id: string;
  org_id: string;
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
  partner_type: string;
  country: string;
  plan_tier: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
  user_count: number;
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

export interface DashboardData {
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
