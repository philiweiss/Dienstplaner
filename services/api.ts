export const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

let AUTH_TOKEN: string | null = null;
export function setAuthToken(token: string | null) {
  AUTH_TOKEN = token;
  try {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  } catch (_) {}
}
export function getAuthToken(): string | null {
  if (AUTH_TOKEN) return AUTH_TOKEN;
  try {
    const t = localStorage.getItem('auth_token');
    AUTH_TOKEN = t;
    return t;
  } catch (_) {
    return AUTH_TOKEN;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any || {})
  };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      if (contentType.includes('application/json')) {
        const err = await res.json();
        message = err?.error || message;
      } else {
        const txt = await res.text();
        if (txt) message = txt;
      }
    } catch (_) {}
    throw new Error(message);
  }
  if (contentType.includes('application/json')) {
    return res.json();
  }
  // @ts-ignore
  return res.text();
}

// Backward-compatible alias used across services
export const jsonFetch = apiFetch;
