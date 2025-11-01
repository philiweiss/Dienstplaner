import { jsonFetch } from './api';
import type { User } from '../types';

export async function login(username: string): Promise<{ user: User }> {
  return jsonFetch<{ user: User }>(`/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username })
  });
}
