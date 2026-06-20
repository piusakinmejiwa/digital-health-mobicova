import api from './client';

export type ContactInput = {
  name: string;
  email: string;
  phone?: string;
  organisation?: string;
  enquiryType?: string;
  subject?: string;
  message: string;
  consent: boolean;
};

export async function submitContact(data: ContactInput): Promise<void> {
  await api.post('/contact', data);
}

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  organisation: string;
  enquiry_type: string;
  subject: string;
  message: string;
  consent: boolean;
  created_at: string;
};

export async function adminListContactMessages(): Promise<ContactMessage[]> {
  return (await api.get('/admin/contact-messages')).data.messages;
}

export async function adminDeleteContactMessage(id: string): Promise<void> {
  await api.delete(`/admin/contact-messages/${id}`);
}
