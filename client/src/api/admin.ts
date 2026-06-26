import api from './client';
import type { Partner, InsurancePlan, Organisation, AdminUser, AuditEntry, SsoConfig, AdminProvider, OrgBranding } from '../types';
import type { SsoConfigInput } from './sso';

// Platform-admin catalog management. All endpoints require platform-admin
// privileges (enforced server-side); the Admin page is only reachable when
// user.isPlatformAdmin is true.

// Providers (clinicians & pharmacists)
export async function adminListProviders(): Promise<AdminProvider[]> {
  return (await api.get('/admin/providers')).data;
}
export async function adminCreateProvider(data: Record<string, unknown>): Promise<AdminProvider> {
  return (await api.post('/admin/providers', data)).data;
}
export async function adminUpdateProvider(id: string, data: Record<string, unknown>): Promise<AdminProvider> {
  return (await api.patch(`/admin/providers/${id}`, data)).data;
}
export async function adminResetProviderPassword(id: string, password: string): Promise<void> {
  await api.post(`/admin/providers/${id}/reset-password`, { password });
}
export async function adminDeleteProvider(id: string): Promise<void> {
  await api.delete(`/admin/providers/${id}`);
}

// Partners
export async function adminListPartners(): Promise<Partner[]> {
  return (await api.get('/admin/partners')).data;
}
export async function adminCreatePartner(data: Record<string, unknown>): Promise<Partner> {
  return (await api.post('/admin/partners', data)).data;
}
export async function adminUpdatePartner(id: string, data: Record<string, unknown>): Promise<Partner> {
  return (await api.patch(`/admin/partners/${id}`, data)).data;
}
export async function adminDeletePartner(id: string): Promise<void> {
  await api.delete(`/admin/partners/${id}`);
}

// Insurance plans
export async function adminListPlans(): Promise<InsurancePlan[]> {
  return (await api.get('/admin/plans')).data;
}
export async function adminCreatePlan(data: Record<string, unknown>): Promise<InsurancePlan> {
  return (await api.post('/admin/plans', data)).data;
}
export async function adminUpdatePlan(id: string, data: Record<string, unknown>): Promise<InsurancePlan> {
  return (await api.patch(`/admin/plans/${id}`, data)).data;
}
export async function adminDeletePlan(id: string): Promise<void> {
  await api.delete(`/admin/plans/${id}`);
}

// Organisations (tenants)
export async function adminListOrgs(): Promise<Organisation[]> {
  return (await api.get('/admin/organisations')).data;
}
export async function adminCreateOrg(data: Record<string, unknown>): Promise<Organisation & { admin_user?: AdminUser }> {
  return (await api.post('/admin/organisations', data)).data;
}
export async function adminUpdateOrg(id: string, data: Record<string, unknown>): Promise<Organisation> {
  return (await api.patch(`/admin/organisations/${id}`, data)).data;
}
export async function adminDeleteOrg(id: string): Promise<void> {
  await api.delete(`/admin/organisations/${id}`);
}
// Per-tenant SAML SSO config, managed on a partner's behalf.
export async function adminGetOrgSso(id: string): Promise<SsoConfig> {
  return (await api.get(`/admin/organisations/${id}/sso`)).data;
}
export async function adminUpdateOrgSso(id: string, data: SsoConfigInput): Promise<SsoConfig> {
  return (await api.put(`/admin/organisations/${id}/sso`, data)).data;
}
// Per-tenant white-label branding, set on a partner's behalf during onboarding.
export async function adminGetOrgBranding(id: string): Promise<OrgBranding> {
  return (await api.get(`/admin/organisations/${id}/branding`)).data;
}
export async function adminUpdateOrgBranding(id: string, data: OrgBranding): Promise<OrgBranding> {
  return (await api.put(`/admin/organisations/${id}/branding`, data)).data;
}

// Organisation onboarding questionnaire (the full B2B intake profile).
export interface OrgOnboarding {
  data: Record<string, Record<string, unknown>>;
  status: 'draft' | 'submitted' | string;
  submitted_at: string | null;
}
export async function adminGetOrgOnboarding(id: string): Promise<OrgOnboarding> {
  return (await api.get(`/admin/organisations/${id}/onboarding`)).data;
}
export async function adminSaveOrgOnboarding(
  id: string,
  data: Record<string, Record<string, unknown>>,
  status: 'draft' | 'submitted',
): Promise<{ ok: boolean; status: string }> {
  return (await api.put(`/admin/organisations/${id}/onboarding`, { data, status })).data;
}

// Onboarding documents (private storage).
export interface OrgDocument {
  id: string; docType: string; fileName: string;
  contentType: string; sizeBytes: number | null; uploadedAt: string; url: string | null;
}
export async function adminListOrgDocuments(id: string): Promise<{ storageEnabled: boolean; documents: OrgDocument[] }> {
  return (await api.get(`/admin/organisations/${id}/documents`)).data;
}
export async function adminUploadOrgDocument(id: string, file: File, docType: string): Promise<OrgDocument> {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType);
  return (await api.post(`/admin/organisations/${id}/documents`, form)).data;
}
export async function adminDeleteOrgDocument(id: string, docId: string): Promise<void> {
  await api.delete(`/admin/organisations/${id}/documents/${docId}`);
}

// HR / payroll integration (generic scaffold). api_key is write-only.
export interface OrgHr {
  provider: string; apiBaseUrl: string; syncCadence: 'manual' | 'daily' | 'weekly' | string;
  status: 'connected' | 'disconnected' | string; lastSyncedAt: string | null; hasKey: boolean;
}
export async function adminGetOrgHr(id: string): Promise<OrgHr> {
  return (await api.get(`/admin/organisations/${id}/hr`)).data;
}
export async function adminSaveOrgHr(id: string, data: { provider: string; apiBaseUrl: string; syncCadence: string; apiKey?: string }): Promise<{ ok: boolean; status: string }> {
  return (await api.put(`/admin/organisations/${id}/hr`, data)).data;
}
export async function adminSyncOrgHr(id: string): Promise<{ ok: boolean; pulled: number; note: string }> {
  return (await api.post(`/admin/organisations/${id}/hr/sync`, {})).data;
}

// Import members into a specific org (platform admin onboarding a tenant).
export async function adminImportOrgMembers(
  id: string, members: Record<string, unknown>[], dryRun = false,
): Promise<import('./resources').MemberImportResult> {
  return (await api.post(`/admin/organisations/${id}/members/import`, { members, dryRun })).data;
}

// Cross-org member management (platform admin — edit a member in ANY org).
export interface AdminOrgMember {
  id: string; membership_id: string; full_name: string; phone: string; email: string;
  gender: string; date_of_birth: string | null; channel: string; status: string;
}
export async function adminListOrgMembers(id: string, q = ''): Promise<{ members: AdminOrgMember[] }> {
  return (await api.get(`/admin/organisations/${id}/members`, { params: q ? { q } : {} })).data;
}
export async function adminUpdateOrgMember(
  id: string, memberId: string, data: Partial<{ fullName: string; phone: string; email: string; gender: string; dateOfBirth: string; channel: string; status: string }>,
): Promise<AdminOrgMember> {
  return (await api.patch(`/admin/organisations/${id}/members/${memberId}`, data)).data;
}

// "View as org" — get a tenant-scoped token to act inside that org.
export async function adminImpersonateOrg(id: string): Promise<{ token: string; org: { id: string; name: string } }> {
  return (await api.post(`/admin/organisations/${id}/impersonate`, {})).data;
}

// Dashboard users
export async function adminListUsers(orgId?: string): Promise<AdminUser[]> {
  return (await api.get('/admin/users', { params: orgId ? { orgId } : undefined })).data;
}
export async function adminCreateUser(data: Record<string, unknown>): Promise<AdminUser> {
  return (await api.post('/admin/users', data)).data;
}
export async function adminUpdateUser(id: string, data: Record<string, unknown>): Promise<AdminUser> {
  return (await api.patch(`/admin/users/${id}`, data)).data;
}
export async function adminResetUserPassword(id: string, password: string): Promise<void> {
  await api.post(`/admin/users/${id}/reset-password`, { password });
}
export async function adminDeleteUser(id: string): Promise<void> {
  await api.delete(`/admin/users/${id}`);
}

// Audit trail (read-only)
export async function adminListAudit(orgId?: string): Promise<AuditEntry[]> {
  return (await api.get('/admin/audit', { params: orgId ? { orgId } : undefined })).data;
}

// AI integration health — live check that Anthropic is actually working.
export type AiModelStatus = {
  role: 'buddy' | 'triage';
  model: string;
  ok: boolean;
  detail?: { status?: number; type?: string; message: string; hint: string };
};
export type AiStatus = {
  configured: boolean;
  working: boolean;
  keyPresent: boolean;
  keyMasked?: string;
  summary: string;
  models: AiModelStatus[];
};
export async function adminAiStatus(): Promise<AiStatus> {
  return (await api.get('/admin/ai-status')).data;
}

// Buddy safety-review queue — flagged conversations (crisis/emergency/distress).
export type BuddySafetyItem = {
  id: string;
  session_key: string;
  channel: string;
  role: string;
  content: string;
  safety: 'crisis' | 'emergency' | 'distress';
  specialty: string | null;
  created_at: string;
};
export type BuddySafetyFeed = {
  days: number;
  total: number;
  byType: Record<string, number>;
  items: BuddySafetyItem[];
};
export async function adminBuddySafety(days = 30): Promise<BuddySafetyFeed> {
  return (await api.get('/admin/buddy-safety', { params: { days } })).data;
}
