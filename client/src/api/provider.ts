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

// Pharmacy partners a doctor can route a prescription to.
export async function getPharmacies(): Promise<{ pharmacies: { id: string; name: string }[] }> {
  const res = await providerApi.get('/provider/pharmacies');
  return res.data;
}

// --- Pharmacist: dispensary ---
export async function getProviderPrescriptions(status?: string): Promise<ProviderPrescriptionsResponse> {
  const res = await providerApi.get('/provider/prescriptions', { params: status ? { status } : {} });
  return res.data;
}

export async function dispensePrescription(id: string): Promise<void> {
  await providerApi.patch(`/provider/prescriptions/${id}/dispense`);
}
