import api from './client';
import type {
  Member, MemberDetail, Partner, Consultation, InsurancePlan, Enrolment,
  TriageSession, TriageSummary, DashboardData,
} from '../types';

// Dashboard
export async function getDashboard(): Promise<DashboardData> {
  return (await api.get('/dashboard')).data;
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
  error?: string;
}
export async function importMembers(members: Record<string, unknown>[]): Promise<MemberImportResult> {
  return (await api.post('/members/import', { members })).data;
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

// Triage
export async function listTriageSessions(): Promise<TriageSummary[]> {
  return (await api.get('/triage')).data;
}
export async function sendTriageMessage(data: {
  sessionId?: string; memberId?: string; message: string;
}): Promise<TriageSession> {
  return (await api.post('/triage/message', data)).data;
}
