export const API_BASE = (import.meta as any).env?.VITE_API_BASE || '';

export async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${input}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!res.ok) {
    const body = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    const err: any = new Error(`Request failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return (isJson ? res.json() : (null as any)) as Promise<T>;
}
