import { jsonFetch } from './api';
import type { User, Role } from '../types';

export async function listUsers(): Promise<User[]> {
  return jsonFetch<User[]>(`/api/users`);
}

export async function createUser(user: { name: string; role: Role | string; birthday?: string | null; anniversary?: string | null }): Promise<User> {
  return jsonFetch<User>(`/api/users`, {
    method: 'POST',
    body: JSON.stringify({ name: user.name, role: user.role, birthday: user.birthday ?? null, anniversary: user.anniversary ?? null })
  });
}

export async function deleteUser(id: string): Promise<void> {
  await jsonFetch<void>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function updateUser(id: string, fields: { name?: string; role?: Role | string; birthday?: string | null; anniversary?: string | null }): Promise<User> {
  return jsonFetch<User>(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(fields)
  });
}

export interface NextShiftItem {
  date: string; // YYYY-MM-DD
  shiftTypeId: string;
  shiftName: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export async function getNextShifts(userId: string, limit = 5): Promise<NextShiftItem[]> {
  return jsonFetch<NextShiftItem[]>(`/api/users/${encodeURIComponent(userId)}/next-shifts?limit=${encodeURIComponent(String(limit))}`);
}
