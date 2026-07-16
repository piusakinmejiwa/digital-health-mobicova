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
