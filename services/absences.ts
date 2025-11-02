import { jsonFetch } from './api';
import type { Absence, AbsenceType, AbsencePart } from '../types';

export async function list(start: string, end: string): Promise<Absence[]> {
  return jsonFetch(`/api/absences?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

export async function listByUser(userId: string, start: string, end: string): Promise<Absence[]> {
  return jsonFetch(`/api/absences/user/${encodeURIComponent(userId)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

export async function create(userId: string, date: string, type: AbsenceType, note?: string | null, part: AbsencePart = 'FULL'): Promise<Absence> {
  return jsonFetch(`/api/absences`, {
    method: 'POST',
    body: JSON.stringify({ userId, date, type, note: note ?? null, part })
  });
}

export async function createRange(userId: string, start: string, end: string, type: AbsenceType, note?: string | null, part: AbsencePart = 'FULL'): Promise<{ created: Absence[]; skipped: { date: string; reason: string }[] }> {
  return jsonFetch(`/api/absences/range`, {
    method: 'POST',
    body: JSON.stringify({ userId, start, end, type, note: note ?? null, part })
  });
}

export async function remove(id: string): Promise<void> {
  await jsonFetch(`/api/absences/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
