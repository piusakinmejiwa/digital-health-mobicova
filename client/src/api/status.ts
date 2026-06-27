import api from './client';

export interface PlatformStatus {
  status: 'operational' | 'degraded' | string;
  components: { api: boolean; database: boolean };
  services: {
    telemedicine: boolean; sms: boolean; whatsapp: boolean;
    email: boolean; payments: boolean; ai: boolean;
  };
  time: string;
}

export async function getPlatformStatus(): Promise<PlatformStatus> {
  return (await api.get('/status')).data;
}
