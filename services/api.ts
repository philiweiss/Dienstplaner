// Simple API client utilities
export interface ApiError extends Error {
  status?: number;
}

const DEFAULT_BASE = '';

export function apiBase(): string {
  // Using relative paths works for same-origin deployment under dev.wproducts.de
  // Allow override via Vite env (optional)
  const envBase = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  return envBase ?? DEFAULT_BASE;
}

export async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiBase() + path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    credentials: 'same-origin',
    ...init,
  });
  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) {
    const err: ApiError = new Error(
      (isJson && body && (body.error || body.message)) || `HTTP ${res.status}`
    );
    err.status = res.status;
    throw err;
  }
  return body as T;
}
