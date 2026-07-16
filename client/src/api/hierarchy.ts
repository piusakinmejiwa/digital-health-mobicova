import api from './client';

// Employer orgs onboarded under the current HMO / insurer (parent_org_id = us).
export interface ChildEmployer {
  id: string;
  name: string;
  slug: string;
  type: string;
  join_code: string;
  is_active: boolean;
  created_at: string;
  member_count: number;
  user_count: number;
}

export async function listChildEmployers(): Promise<ChildEmployer[]> {
  return (await api.get('/hierarchy/employers')).data;
}

export async function createChildEmployer(data: {
  name: string;
  adminEmail?: string;
  adminFullName?: string;
  adminPassword?: string;
}): Promise<ChildEmployer & { admin_user?: { email: string } }> {
  return (await api.post('/hierarchy/employers', data)).data;
}

// ── Plan assignments ──
export interface AssignablePlan {
  id: string; name: string; plan_type: string; kind: string; monthly_premium: string; currency: string;
}
export interface EmployerAssignment {
  id: string; plan_id: string; negotiated_premium: string | null; status: string; created_at: string;
  plan_name: string; kind: string; list_premium: string; currency: string; effective_premium: string;
}

export async function listAssignablePlans(): Promise<AssignablePlan[]> {
  return (await api.get('/hierarchy/plans')).data;
}
export async function listEmployerAssignments(employerId: string): Promise<EmployerAssignment[]> {
  return (await api.get(`/hierarchy/employers/${employerId}/plans`)).data;
}
export async function assignPlan(employerId: string, data: { planId: string; negotiatedPremium?: string | null }): Promise<EmployerAssignment> {
  return (await api.post(`/hierarchy/employers/${employerId}/plans`, data)).data;
}
export async function unassignPlan(employerId: string, assignmentId: string): Promise<void> {
  await api.delete(`/hierarchy/employers/${employerId}/plans/${assignmentId}`);
}

// ── Members under a child employer ──
export interface EmployerMember {
  id: string; full_name: string; membership_id: string; status: string; channel: string; created_at: string;
}
export async function listEmployerMembers(employerId: string): Promise<EmployerMember[]> {
  return (await api.get(`/hierarchy/employers/${employerId}/members`)).data;
}
export async function addEmployerMember(employerId: string, data: {
  fullName: string; phone?: string; email?: string; dateOfBirth?: string; gender?: string;
}): Promise<EmployerMember> {
  return (await api.post(`/hierarchy/employers/${employerId}/members`, data)).data;
}
