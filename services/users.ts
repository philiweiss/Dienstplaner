import { jsonFetch } from './api';
import type { User } from '../types';

export async function listUsers(): Promise<User[]> {
  return jsonFetch<User[]>('/api/users');
}

export async function createUser(user: Omit<User, 'id'>): Promise<User> {
  return jsonFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(user),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await jsonFetch<void>(`/api/users/${id}`, { method: 'DELETE' });
}
