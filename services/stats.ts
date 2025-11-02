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

export interface WeeklyStatItem {
  year: number;
  week: number;
  total: number;
  byShiftType: ShiftTypeCount[];
}

export async function getUserStats(userId: string): Promise<UserStats> {
  return jsonFetch<UserStats>(`/api/stats/user/${encodeURIComponent(userId)}`);
}

export async function getWeeklyStats(start: string, end: string): Promise<WeeklyStatItem[]> {
  const params = new URLSearchParams({ start, end });
  return jsonFetch<WeeklyStatItem[]>(`/api/stats/weekly?${params.toString()}`);
}
