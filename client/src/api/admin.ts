import api from './client';
import type { Partner, InsurancePlan, Organisation, AdminUser, AuditEntry } from '../types';

// Platform-admin catalog management. All endpoints require platform-admin
// privileges (enforced server-side); the Admin page is only reachable when
// user.isPlatformAdmin is true.

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
