import providerApi from './providerClient';
import type {
  ProviderSession, ProviderConsultation, ProviderConsultationsResponse,
  ProviderPrescriptionsResponse,
} from '../types';

// --- Auth ---
export async function providerLogin(
  email: string,
  password: string
): Promise<{ token: string; provider: ProviderSession }> {
  const res = await providerApi.post('/provider/auth/login', { email, password });
  return res.data;
}

// "Sign out of all devices" — revokes every outstanding token for this provider.
export async function providerLogoutAllDevices(): Promise<void> {
  await providerApi.post('/provider/auth/logout-all');
}

// Forgotten password (provider portal).
export async function providerForgotPassword(email: string): Promise<void> {
  await providerApi.post('/provider/auth/forgot-password', { email });
}
export async function providerResetPassword(token: string, password: string): Promise<void> {
  await providerApi.post('/provider/auth/reset-password', { token, password });
}

export async function getProviderMe(): Promise<ProviderSession> {
  const res = await providerApi.get('/provider/me');
  return res.data;
}

// --- Doctor: consultations ---
export async function getProviderConsultations(status?: string): Promise<ProviderConsultationsResponse> {
  const res = await providerApi.get('/provider/consultations', { params: status ? { status } : {} });
  return res.data;
}

export async function getProviderConsultation(id: string): Promise<ProviderConsultation> {
  const res = await providerApi.get(`/provider/consultations/${id}`);
  return res.data;
}

export async function acceptConsultation(id: string): Promise<void> {
  await providerApi.post(`/provider/consultations/${id}/accept`);
}

// Get a Daily join token (host) for a consultation — works for video and voice
// (voice joins the same room camera-off). Throws 503 if Daily isn't configured
// yet — the caller falls back to the demo call screen.
export async function getConsultationCallToken(
  id: string
): Promise<{ roomUrl: string; token: string; mode?: 'video' | 'voice'; recording?: boolean; recordingConsent?: boolean }> {
  const res = await providerApi.post(`/provider/consultations/${id}/call`);
  return res.data;
}

// Live calls where a member is waiting to be joined (for the incoming-call badge).
export type IncomingCall = { id: string; mode: 'video' | 'voice'; member_name: string; created_at: string };
export async function getIncomingCalls(): Promise<{ calls: IncomingCall[] }> {
  return (await providerApi.get('/provider/incoming-calls')).data;
}

// Fresh signed link to a consultation's recording (PHI; short-lived).
export async function getConsultationRecording(
  id: string
): Promise<{ available: boolean; consent: boolean; status?: string; durationSeconds?: number; link?: string | null }> {
  return (await providerApi.get(`/provider/consultations/${id}/recording`)).data;
}

export async function updateConsultation(
  id: string,
  data: Partial<{ status: string; notes: string; diagnosis: string }>
): Promise<ProviderConsultation> {
  const res = await providerApi.patch(`/provider/consultations/${id}`, data);
  return res.data;
}

export async function addPrescription(
  id: string,
  data: { medication: string; dosage?: string; instructions?: string; pharmacyPartnerId?: string }
): Promise<void> {
  await providerApi.post(`/provider/consultations/${id}/prescriptions`, data);
}

// Pharmacies a doctor can route a prescription to. Pass a consultId to get them
// ranked nearest-first to that patient (each with a distance in km).
export type PharmacyOption = { id: string; name: string; city?: string; distanceKm?: number | null };
export async function getPharmacies(consultId?: string): Promise<{ pharmacies: PharmacyOption[] }> {
  const res = await providerApi.get('/provider/pharmacies', { params: consultId ? { consultId } : {} });
  return res.data;
}

// --- Pharmacist: dispensary ---
export async function getProviderPrescriptions(status?: string): Promise<ProviderPrescriptionsResponse> {
  const res = await providerApi.get('/provider/prescriptions', { params: status ? { status } : {} });
  return res.data;
}

// Advance a prescription through its fulfilment state machine:
//   pending → ready → (collected | out_for_delivery → delivered)
// On 'out_for_delivery' the pharmacist can attach a courier + tracking ref;
// otherwise the server auto-generates a tracking reference.
export async function advancePrescription(
  id: string,
  status: 'ready' | 'out_for_delivery' | 'collected' | 'delivered',
  data?: { courierName?: string; trackingRef?: string }
): Promise<import('../types').ProviderPrescription> {
  const res = await providerApi.patch(`/provider/prescriptions/${id}/advance`, { status, ...data });
  return res.data;
}
