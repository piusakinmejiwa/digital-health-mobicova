import memberApi from './memberClient';
import type {
  MemberSession, MemberProfile, MemberOverview, OtpRequestResult, Claim, ClaimDetail,
} from '../types';

// --- Passwordless auth ---
export async function requestMemberOtp(identifier: string): Promise<OtpRequestResult> {
  const res = await memberApi.post('/member/auth/request-otp', { identifier });
  return res.data;
}

export async function verifyMemberOtp(
  identifier: string,
  code: string
): Promise<{ token: string; member: MemberSession }> {
  const res = await memberApi.post('/member/auth/verify-otp', { identifier, code });
  return res.data;
}

// --- Authenticated portal data ---
export async function getMemberMe(): Promise<MemberProfile> {
  const res = await memberApi.get('/member/me');
  return res.data;
}

export async function getMemberOverview(): Promise<MemberOverview> {
  const res = await memberApi.get('/member/overview');
  return res.data;
}

export async function getMemberClaims(): Promise<{ claims: Claim[] }> {
  const res = await memberApi.get('/member/claims');
  return res.data;
}

export async function getMemberClaim(id: string): Promise<ClaimDetail> {
  const res = await memberApi.get(`/member/claims/${id}`);
  return res.data;
}

export async function submitMemberClaim(data: {
  claimType: string;
  providerName: string;
  amount: number;
  description?: string;
  serviceDate?: string;
  enrolmentId?: string;
}): Promise<Claim> {
  const res = await memberApi.post('/member/claims', data);
  return res.data;
}

// AI symptom check (member-scoped triage). Returns the updated session.
export interface MemberTriageSession {
  id: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  triage_level: string;
  recommendation: string;
  engine: string;
}

export async function sendMemberTriage(message: string, sessionId?: string): Promise<MemberTriageSession> {
  const res = await memberApi.post('/member/triage', { message, sessionId });
  return res.data;
}

// Log a completed telemedicine call as a consultation (shows in recent care + dashboard).
export async function logMemberConsultation(data: {
  mode: 'video' | 'voice';
  doctorName: string;
  durationSeconds: number;
}): Promise<void> {
  await memberApi.post('/member/consultations', data);
}
