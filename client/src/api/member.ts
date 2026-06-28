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

// Start a live consultation. Creates the consult (so the doctor sees it in their
// queue) and, when Daily video is configured, returns the member's join token.
export interface StartConsultResult {
  consultation: { id: string; mode: 'video' | 'voice'; doctor_name: string; status: string };
  video: { roomUrl: string; token: string } | null;
  recording: boolean;
}
export async function startConsultation(data: {
  mode: 'video' | 'voice';
  doctorName: string;
  recordingConsent?: boolean;
}): Promise<StartConsultResult> {
  const res = await memberApi.post('/member/consultations/start', data);
  return res.data;
}

// Member sets their address so prescriptions can route to the nearest pharmacy.
export async function updateMemberLocation(data: { address: string; city: string }): Promise<{ saved: boolean; geocoded: boolean }> {
  return (await memberApi.patch('/member/profile/location', data)).data;
}

// Close out a started consultation with its duration (marks it completed).
export async function completeConsultation(id: string, durationSeconds: number): Promise<void> {
  await memberApi.post(`/member/consultations/${id}/complete`, { durationSeconds });
}

// Place a real masked phone call: MobiCova rings the member's phone, then bridges
// to the doctor — both see only the MobiCova number. Returns once the call is
// queued (the member's phone then rings); duration is logged via webhook.
export interface PhoneCallResult {
  consultationId: string;
  status: string;
  maskedNumber: string;
  doctorName: string;
}
export async function startPhoneCall(doctorName: string): Promise<PhoneCallResult> {
  const res = await memberApi.post('/member/consultations/phone-call', { doctorName });
  return res.data;
}

// Doctors a member can call (live from the providers directory).
export async function getMemberDoctors(): Promise<{ doctors: import('../types').MemberDoctor[] }> {
  const res = await memberApi.get('/member/doctors');
  return res.data;
}

// Choose how a prescription reaches the member: pickup at the pharmacy or
// courier delivery to an address. Returns the updated prescription row.
export async function setPrescriptionFulfilment(
  id: string,
  method: 'pickup' | 'delivery',
  address?: string
): Promise<import('../types').Prescription> {
  const res = await memberApi.post(`/member/prescriptions/${id}/fulfilment`, { method, address });
  return res.data;
}

// --- Rewards (gamification) ---
export interface RewardBadge {
  slug: string;
  label: string;
  emoji: string;
  description: string;
  earned: boolean;
  earnedAt: string | null;
}
export interface MemberRewards {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  badges: RewardBadge[];
}
export async function getMemberRewards(): Promise<MemberRewards> {
  const res = await memberApi.get('/member/rewards');
  return res.data;
}

// --- Phase 2: challenges + leaderboard ---
export interface MemberChallenge {
  id: string; title: string; description: string; target: number;
  window: string; bonusPoints: number; current: number; completed: boolean; sponsored: boolean;
}
export async function getMemberChallenges(): Promise<{ challenges: MemberChallenge[] }> {
  return (await memberApi.get('/member/challenges')).data;
}
export interface Leaderboard {
  optedIn: boolean; rank: number | null; total: number;
  top: { rank: number; points: number; isYou: boolean }[];
}
export async function getMemberLeaderboard(): Promise<Leaderboard> {
  return (await memberApi.get('/member/leaderboard')).data;
}
export async function setMemberLeaderboardOptIn(optIn: boolean): Promise<Leaderboard> {
  return (await memberApi.post('/member/leaderboard/opt-in', { optIn })).data;
}

// --- Phase 3: redemption ---
export interface CatalogueItem {
  id: string; title: string; description: string; kind: string;
  cost_points: number; value_label: string; stock: number | null; sponsored?: boolean;
}
export interface Redemption {
  id: string; title: string; cost_points: number; status: string; note: string; created_at: string;
}
export async function getMemberCatalogue(): Promise<{ items: CatalogueItem[]; balance: number }> {
  return (await memberApi.get('/member/rewards/catalogue')).data;
}
export async function redeemReward(catalogueId: string): Promise<{ redemption: Redemption; balance: number }> {
  return (await memberApi.post('/member/rewards/redeem', { catalogueId })).data;
}
export async function getMemberRedemptions(): Promise<{ redemptions: Redemption[] }> {
  return (await memberApi.get('/member/rewards/redemptions')).data;
}
