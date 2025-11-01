import { jsonFetch } from './api';
import type { User, Role } from '../types';

export async function listUsers(): Promise<User[]> {
  return jsonFetch<User[]>(`/api/users`);
}

export async function createUser(user: { name: string; role: Role | string }): Promise<User> {
  return jsonFetch<User>(`/api/users`, {
    method: 'POST',
    body: JSON.stringify({ name: user.name, role: user.role })
  });
}

export async function deleteUser(id: string): Promise<void> {
  await jsonFetch<void>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function updateUser(id: string, fields: { name?: string; role?: Role | string }): Promise<User> {
  return jsonFetch<User>(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(fields)
  });
}
