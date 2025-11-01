import { jsonFetch } from './api';
import type { ShiftAssignment } from '../types';

export async function listAssignments(start: string, end: string): Promise<ShiftAssignment[]> {
  const data = await jsonFetch<any[]>(`/api/assignments?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  // Map to ShiftAssignment (ignore id from server)
  return data.map(item => ({
    date: item.date,
    shiftTypeId: item.shiftTypeId,
    userIds: Array.isArray(item.userIds) ? item.userIds : [],
  }));
}

export async function assign(date: string, shiftTypeId: string, userId: string): Promise<void> {
  await jsonFetch(`/api/assignments/assign`, {
    method: 'POST',
    body: JSON.stringify({ date, shiftTypeId, userId })
  });
}

export async function unassign(date: string, shiftTypeId: string, userId: string): Promise<void> {
  await jsonFetch(`/api/assignments/unassign`, {
    method: 'POST',
    body: JSON.stringify({ date, shiftTypeId, userId })
  });
}
