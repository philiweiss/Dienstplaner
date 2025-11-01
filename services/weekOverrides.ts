import { jsonFetch } from './api';
import type { WeekShiftOverride } from '../types';

export async function listWeekOverrides(year?: number): Promise<WeekShiftOverride[]> {
  const qs = year ? `?year=${encodeURIComponent(year)}` : '';
  return jsonFetch<WeekShiftOverride[]>(`/api/week-overrides${qs}`);
}

export async function updateWeekOverride(input: { year: number; weekNumber: number; shiftTypeId: string; minUsers?: number; maxUsers?: number }): Promise<WeekShiftOverride> {
  return jsonFetch<WeekShiftOverride>(`/api/week-overrides`, {
    method: 'PUT',
    body: JSON.stringify(input)
  });
}
