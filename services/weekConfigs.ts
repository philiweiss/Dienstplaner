import { jsonFetch } from './api';
import type { WeekConfig, WeekStatus } from '../types';

export async function listWeekConfigs(year?: number): Promise<WeekConfig[]> {
  const qs = typeof year === 'number' ? `?year=${encodeURIComponent(year)}` : '';
  return jsonFetch<WeekConfig[]>(`/api/week-configs${qs}`);
}

export async function updateWeekConfig(input: { year: number; weekNumber: number; status: WeekStatus }): Promise<WeekConfig> {
  return jsonFetch<WeekConfig>(`/api/week-configs`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
