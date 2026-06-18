import api from './client';

export type FeedbackPayload = {
  name: string;
  email: string;
  organisation?: string;
  role?: string;
  country?: string;
  wantedFeatures: string[];
  priorities: string[];
  useCase?: string;
  pilotInterest?: boolean;
  consent?: boolean;
};

export async function submitFeedback(data: FeedbackPayload): Promise<void> {
  await api.post('/feedback', data);
}

export type ProspectSubmission = {
  id: string;
  name: string;
  email: string;
  organisation: string;
  role: string;
  country: string;
  wanted_features: string[];
  priorities: string[];
  use_case: string;
  pilot_interest: boolean;
  consent: boolean;
  created_at: string;
};

export type ProspectFeedbackResult = {
  submissions: ProspectSubmission[];
  total: number;
  interest: Record<string, number>;
  score: Record<string, number>;
};

export async function getProspectFeedback(): Promise<ProspectFeedbackResult> {
  const { data } = await api.get<ProspectFeedbackResult>('/admin/prospect-feedback');
  return data;
}
