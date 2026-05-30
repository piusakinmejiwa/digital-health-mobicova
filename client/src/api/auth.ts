import api from './client';
import type { AuthResponse, User } from '../types';

export async function registerUser(data: {
  email: string;
  password: string;
  fullName: string;
  orgName: string;
  partnerType: string;
}): Promise<AuthResponse> {
  const res = await api.post('/auth/register', data);
  return res.data;
}

export async function loginUser(data: { email: string; password: string }): Promise<AuthResponse> {
  const res = await api.post('/auth/login', data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get('/auth/me');
  return res.data;
}
