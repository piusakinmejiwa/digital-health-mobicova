import api from './client';

export interface DataExportRequest {
  id: string; requester: string; scope: string; status: string; note: string; created_at: string;
}
export interface ComplianceStatus {
  dpa: { acceptedAt: string; acceptedName: string; version: string } | null;
  currentDpaVersion: string;
  upToDate: boolean;
  exports: DataExportRequest[];
}

export async function getCompliance(): Promise<ComplianceStatus> {
  return (await api.get('/settings/compliance')).data;
}
export async function acceptDpa(name?: string): Promise<{ accepted: boolean }> {
  return (await api.post('/settings/compliance/dpa/accept', name ? { name } : {})).data;
}
export async function requestDataExport(scope = 'all', note = ''): Promise<DataExportRequest> {
  return (await api.post('/settings/compliance/data-export', { scope, note })).data;
}
