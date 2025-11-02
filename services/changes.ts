import { apiFetch } from './api';

export interface ChangeItem {
  id: string;
  date: string; // YYYY-MM-DD
  shiftTypeId: string;
  action: 'ASSIGNED' | 'UNASSIGNED' | 'SWAPPED' | 'SUBSTITUTION';
  actorUserId?: string | null;
  targetUserId?: string | null;
  shiftTypeName?: string;
  shiftTypeColor?: string;
  actorName?: string | null;
  targetName?: string | null;
  details?: string | null;
  createdAt: string;
}

export async function getUnreadChangesCount(): Promise<{ count: number }> {
  return apiFetch('/api/changes/unread-count');
}

export async function getRecentChanges(limit = 20): Promise<ChangeItem[]> {
  return apiFetch(`/api/changes/recent?limit=${limit}`);
}

export async function markChangesSeen(): Promise<{ ok: boolean }> {
  return apiFetch('/api/changes/mark-seen', { method: 'POST' });
}

export function formatChangeText(c: ChangeItem): string {
  const date = new Date(c.date).toLocaleDateString('de-DE');
  const st = c.shiftTypeName || c.shiftTypeId;
  switch (c.action) {
    case 'ASSIGNED':
      return `Neu zugeteilt: ${c.targetName || 'N.N.'} für ${st} am ${date}`;
    case 'UNASSIGNED':
      return `Entfernt: ${c.targetName || 'N.N.'} von ${st} am ${date}`;
    case 'SWAPPED':
      return `Tausch: ${st} am ${date}`;
    case 'SUBSTITUTION':
      return `Vertretung: ${c.actorName || 'N.N.'} → ${c.targetName || 'N.N.'} (${st}) am ${date}`;
    default:
      return `${c.action} ${st} am ${date}`;
  }
}
