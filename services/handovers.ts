import { jsonFetch } from './api';
import type { HandoverRequest } from '../types';

export async function createHandover(body: { date: string; shiftTypeId: string; fromUserId: string; toUserId: string }): Promise<HandoverRequest> {
  return jsonFetch<HandoverRequest>(`/api/handovers`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function listMine(userId: string): Promise<{ incoming: HandoverRequest[]; outgoing: HandoverRequest[] }> {
  return jsonFetch<{ incoming: HandoverRequest[]; outgoing: HandoverRequest[] }>(`/api/handovers/mine?userId=${encodeURIComponent(userId)}`);
}

export async function listAdmin(): Promise<HandoverRequest[]> {
  return jsonFetch<HandoverRequest[]>(`/api/handovers/admin`);
}

export async function respond(id: string, userId: string, action: 'accept' | 'reject'): Promise<{ id: string; status: string }> {
  return jsonFetch<{ id: string; status: string }>(`/api/handovers/${encodeURIComponent(id)}/respond`, {
    method: 'POST',
    body: JSON.stringify({ userId, action })
  });
}

export async function approve(id: string, adminId: string): Promise<{ id: string; status: string }> {
  return jsonFetch<{ id: string; status: string }>(`/api/handovers/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ adminId })
  });
}

export async function decline(id: string, adminId: string): Promise<{ id: string; status: string }> {
  return jsonFetch<{ id: string; status: string }>(`/api/handovers/${encodeURIComponent(id)}/decline`, {
    method: 'POST',
    body: JSON.stringify({ adminId })
  });
}
