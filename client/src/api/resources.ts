import api from './client';
import type {
  Member, MemberDetail, Partner, Consultation, InsurancePlan, Enrolment,
  TriageSession, TriageSummary, DashboardData, AnalyticsReport,
  Claim, ClaimDetail, ClaimDocument, ClaimsResponse,
  AnalyticsQueryResult, AnalyticsMeasureOption,
} from '../types';

// Dashboard
export async function getDashboard(): Promise<DashboardData> {
  return (await api.get('/dashboard')).data;
}

export async function dismissOnboarding(): Promise<void> {
  await api.post('/dashboard/onboarding/dismiss', { dismissed: true });
}

export async function getAnalyticsQueryOptions(): Promise<{ measures: AnalyticsMeasureOption[] }> {
  return (await api.get('/analytics/query/options')).data;
}

export async function getAnalyticsQuery(measure: string, dimension: string, months: number): Promise<AnalyticsQueryResult> {
  return (await api.get('/analytics/query', { params: { measure, dimension, months } })).data;
}

// Analytics & reporting
export async function getAnalytics(months = 6): Promise<AnalyticsReport> {
  return (await api.get('/analytics', { params: { months } })).data;
}

// Members
export async function listMembers(): Promise<Member[]> {
  return (await api.get('/members')).data;
}
export async function getMember(id: string): Promise<MemberDetail> {
  return (await api.get(`/members/${id}`)).data;
}
export async function createMember(data: Record<string, unknown>): Promise<Member> {
  return (await api.post('/members', data)).data;
}
export interface MemberImportResult {
  inserted: number;
  total: number;
  skipped: { row: number; reason: string }[];
  // Imported but flagged (e.g. no phone/email — can't receive a login code).
  warnings?: { row: number; reason: string }[];
  error?: string;
  // Present on a dry run: nothing was written.
  dryRun?: boolean;
  wouldImport?: number;
  preview?: { fullName: string; phone: string; email: string }[];
}
// dryRun=true validates against the server and previews without writing anything.
export async function importMembers(members: Record<string, unknown>[], dryRun = false): Promise<MemberImportResult> {
  return (await api.post('/members/import', { members, dryRun })).data;
}
export async function updateMember(id: string, data: Record<string, unknown>): Promise<Member> {
  return (await api.put(`/members/${id}`, data)).data;
}
export async function deleteMember(id: string): Promise<void> {
  await api.delete(`/members/${id}`);
}

// Partners
export async function listPartners(): Promise<Partner[]> {
  return (await api.get('/partners')).data;
}

// Telemedicine
export async function listConsultations(): Promise<Consultation[]> {
  return (await api.get('/consultations')).data;
}
export async function getConsultation(id: string): Promise<Consultation> {
  return (await api.get(`/consultations/${id}`)).data;
}
export async function bookConsultation(data: Record<string, unknown>): Promise<Consultation> {
  return (await api.post('/consultations', data)).data;
}
export async function updateConsultation(id: string, data: Record<string, unknown>): Promise<Consultation> {
  return (await api.put(`/consultations/${id}`, data)).data;
}
export async function addPrescription(id: string, data: Record<string, unknown>) {
  return (await api.post(`/consultations/${id}/prescriptions`, data)).data;
}

// Insurance
export async function listPlans(): Promise<InsurancePlan[]> {
  return (await api.get('/insurance/plans')).data;
}
export async function listEnrolments(): Promise<Enrolment[]> {
  return (await api.get('/insurance/enrolments')).data;
}
export async function enrolMember(data: { memberId: string; planId: string }): Promise<Enrolment> {
  return (await api.post('/insurance/enrolments', data)).data;
}
export async function checkoutPremium(enrolmentId: string): Promise<{ provider: 'paystack' | 'stripe' | 'demo'; url?: string; message?: string }> {
  return (await api.post(`/insurance/enrolments/${enrolmentId}/checkout`)).data;
}

// Claims
export async function listClaims(status?: string): Promise<ClaimsResponse> {
  return (await api.get('/claims', { params: status ? { status } : {} })).data;
}
export async function getClaim(id: string): Promise<ClaimDetail> {
  return (await api.get(`/claims/${id}`)).data;
}
export async function createClaim(data: Record<string, unknown>): Promise<Claim> {
  return (await api.post('/claims', data)).data;
}
export async function decideClaim(id: string, status: string, note?: string): Promise<Claim> {
  return (await api.patch(`/claims/${id}/decision`, { status, note })).data;
}
export async function uploadClaimDocument(id: string, file: File, label?: string): Promise<ClaimDocument> {
  const form = new FormData();
  form.append('file', file);
  if (label) form.append('label', label);
  // Let the browser set the multipart boundary; overriding the JSON default.
  return (await api.post(`/claims/${id}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })).data;
}

// Triage
export async function listTriageSessions(): Promise<TriageSummary[]> {
  return (await api.get('/triage')).data;
}
export async function sendTriageMessage(data: {
  sessionId?: string; memberId?: string; message: string;
}): Promise<TriageSession> {
  return (await api.post('/triage/message', data)).data;
}
