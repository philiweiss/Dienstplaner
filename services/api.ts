export const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
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
