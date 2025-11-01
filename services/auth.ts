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

export async function loginPassword(username: string, password: string): Promise<{ user: User }> {
  return jsonFetch(`/api/auth/login-password`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function setPassword(username: string, password: string): Promise<{ user: User }> {
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
