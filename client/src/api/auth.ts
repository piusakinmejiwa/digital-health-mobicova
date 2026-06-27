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

// Invited admin sets their password from the welcome-email activation link.
export async function activateAccount(data: { token: string; password: string }): Promise<{ ok: boolean; email: string }> {
  const res = await api.post('/auth/activate', data);
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

// --- Active sessions (device management) ---
export interface UserSession {
  id: string; user_agent: string; ip: string;
  created_at: string; last_seen_at: string; current: boolean;
}
export async function listSessions(): Promise<{ sessions: UserSession[] }> {
  return (await api.get('/auth/sessions')).data;
}
export async function revokeSession(id: string): Promise<void> {
  await api.post(`/auth/sessions/${id}/revoke`, {});
}
export async function revokeOtherSessions(): Promise<void> {
  await api.post('/auth/sessions/revoke-others', {});
}
