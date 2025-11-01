import { jsonFetch } from './api';
import type { ShiftType } from '../types';

export async function listShiftTypes(): Promise<ShiftType[]> {
  return jsonFetch<ShiftType[]>(`/api/shift-types`);
}

export async function createShiftType(input: Omit<ShiftType, 'id'>): Promise<ShiftType> {
  const body = {
    name: input.name,
    startTime: input.startTime,
    endTime: input.endTime,
    color: input.color,
    minUsers: input.minUsers,
    maxUsers: input.maxUsers,
  };
  return jsonFetch<ShiftType>(`/api/shift-types`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateShiftType(id: string, fields: Partial<Omit<ShiftType, 'id'>>): Promise<Partial<ShiftType>> {
  return jsonFetch<Partial<ShiftType>>(`/api/shift-types/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

export async function deleteShiftType(id: string): Promise<void> {
  await jsonFetch<void>(`/api/shift-types/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
