import { jsonFetch } from './api';

export type LateReason = 'VERKEHR' | 'ARZT' | 'KIND_BETREUUNG' | 'OEFFIS' | 'WETTER' | 'SONSTIGES';

export interface LateArrival {
  id: string;
  assignmentId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  shiftTypeId: string;
  arriveTime: string; // HH:mm
  reason: LateReason;
  note?: string | null;
}

export async function list(start: string, end: string): Promise<LateArrival[]> {
  return jsonFetch(`/api/late-arrivals?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
}

export async function create(input: { date: string; shiftTypeId: string; userId: string; arriveTime: string; reason: LateReason; note?: string | null }): Promise<LateArrival> {
  return jsonFetch(`/api/late-arrivals`, {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function remove(id: string): Promise<void> {
  await jsonFetch(`/api/late-arrivals/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
