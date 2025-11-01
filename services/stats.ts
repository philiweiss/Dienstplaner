import { jsonFetch } from './api';

export interface ShiftTypeCount {
  shiftTypeId: string;
  name: string;
  color: string;
  count: number;
}

export interface UserStats {
  userId: string;
  total: number;
  byShiftType: ShiftTypeCount[];
  lastDate: string | null;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  return jsonFetch<UserStats>(`/api/stats/user/${encodeURIComponent(userId)}`);
}
