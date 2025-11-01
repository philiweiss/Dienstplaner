import { jsonFetch } from './api';
import type { DayNote } from '../types';

export async function list(start: string, end: string): Promise<DayNote[]> {
  return jsonFetch<DayNote[]>(`/api/day-notes?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

export async function set(date: string, input: { note: string; adminOnly?: boolean; approved?: boolean; createdBy?: string | null; approvedBy?: string | null }): Promise<DayNote> {
  return jsonFetch<DayNote>(`/api/day-notes/${encodeURIComponent(date)}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}

export async function remove(date: string): Promise<void> {
  await jsonFetch<void>(`/api/day-notes/${encodeURIComponent(date)}`, { method: 'DELETE' });
}
