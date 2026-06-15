import api from './client';
import type { AuditEntry } from '../types';

// The signed-in org admin's own organisation activity trail.
export async function getOrgActivity(): Promise<AuditEntry[]> {
  return (await api.get('/activity')).data;
}
