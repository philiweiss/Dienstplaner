import { jsonFetch } from './api';
import type { User } from '../types';

export async function login(username: string): Promise<{ user: User; needsPassword?: boolean }> {
  return jsonFetch<{ user: User; needsPassword?: boolean }>(`/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username })
  });
}

export async function checkUser(username: string): Promise<{ exists: boolean; needsPassword?: boolean; user?: User }> {
  return jsonFetch(`/api/auth/check-user`, {
    method: 'POST',
    body: JSON.stringify({ username })
  });
}

export async function loginPassword(username: string, password: string): Promise<{ user: User; token: string }> {
  return jsonFetch(`/api/auth/login-password`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function setPassword(username: string, password: string): Promise<{ user: User; token: string }> {
  return jsonFetch(`/api/auth/set-password`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function changePassword(username: string, currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({ username, currentPassword, newPassword })
  });
}

export async function adminResetPassword(target: { userId?: string; username?: string }, newPassword: string): Promise<{ ok: boolean; user: User }> {
  return jsonFetch(`/api/auth/admin/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ ...target, newPassword })
  });
}

export async function adminDeletePassword(userId: string): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/auth/admin/delete-password`, {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
}

// Passkeys / WebAuthn
export async function startPasskeyRegistration(): Promise<any> {
  return jsonFetch(`/api/auth/passkey/register/start`, { method: 'POST', body: JSON.stringify({}) });
}
export async function finishPasskeyRegistration(credential: any): Promise<{ ok: boolean }> {
  return jsonFetch(`/api/auth/passkey/register/finish`, { method: 'POST', body: JSON.stringify(credential) });
}
export async function startPasskeyLogin(username: string): Promise<any> {
  return jsonFetch(`/api/auth/passkey/login/start`, { method: 'POST', body: JSON.stringify({ username }) });
}
export async function finishPasskeyLogin(userId: string, credential: any): Promise<{ user: User; token: string }> {
  return jsonFetch(`/api/auth/passkey/login/finish`, { method: 'POST', body: JSON.stringify({ userId, credential }) });
}
