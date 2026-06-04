import api from './client';

export async function submitLead(data: {
  email: string;
  company?: string;
  partnerType?: string;
  memberBand?: string;
}): Promise<void> {
  await api.post('/leads', data);
}
