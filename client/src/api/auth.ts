import api from './client';
import type { AuthResponse, User, LoginResult, MfaStatus, MfaSetup } from '../types';

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

export async function loginUser(data: { email: string; password: string }): Promise<LoginResult> {
  const res = await api.post('/auth/login', data);
  return res.data;
}

// Second MFA step: trade the pending token + a TOTP/backup code for a session.
export async function mfaChallenge(data: { mfaToken: string; code: string }): Promise<AuthResponse> {
  const res = await api.post('/auth/mfa/challenge', data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get('/auth/me');
  return res.data;
}

// --- MFA self-service (Security settings) ---
export async function getMfaStatus(): Promise<MfaStatus> {
  const res = await api.get('/auth/mfa/status');
  return res.data;
}

export async function startMfaSetup(): Promise<MfaSetup> {
  const res = await api.post('/auth/mfa/setup');
  return res.data;
}

export async function enableMfa(code: string): Promise<{ enabled: boolean; backupCodes: string[] }> {
  const res = await api.post('/auth/mfa/enable', { code });
  return res.data;
}

export async function disableMfa(password: string): Promise<{ enabled: boolean }> {
  const res = await api.post('/auth/mfa/disable', { password });
  return res.data;
}
