import api from './client';

export type NewsletterInput = { name: string; email: string; phone?: string; consent: boolean };

export async function subscribeNewsletter(data: NewsletterInput): Promise<void> {
  await api.post('/newsletter', data);
}

export type NewsletterSignup = {
  id: string; name: string; email: string; phone: string; consent: boolean; created_at: string;
};

export async function adminListNewsletter(): Promise<NewsletterSignup[]> {
  return (await api.get('/admin/newsletter')).data.signups;
}
