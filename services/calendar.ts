import { jsonFetch } from './api';

export interface CalendarTokenResponse {
  token: string;
  url: string;
}

export async function getOrCreateCalendarUrl(userId: string): Promise<CalendarTokenResponse> {
  return jsonFetch<CalendarTokenResponse>('/api/calendar/token', {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
}

export async function regenerateCalendarUrl(userId: string): Promise<CalendarTokenResponse> {
  return jsonFetch<CalendarTokenResponse>('/api/calendar/token', {
    method: 'POST',
    body: JSON.stringify({ userId, regenerate: true })
  });
}
