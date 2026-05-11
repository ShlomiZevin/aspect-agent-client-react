import { getSuperAdminKey } from './superAdminService';

const DEFAULT_BASE_URL = 'https://aspect-agent-server-1018338671074.europe-west1.run.app';

export function getBaseURL(): string {
  return import.meta.env.VITE_API_URL || DEFAULT_BASE_URL;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  baseURL?: string
): Promise<T> {
  const url = `${baseURL || getBaseURL()}${endpoint}`;

  // Attach the super-admin key on every request when unlocked. The server
  // only honours it for endpoints that opt-in (admin user list/stats).
  const superKey = getSuperAdminKey();
  const extraHeaders: Record<string, string> = superKey ? { 'X-Super-Admin-Key': superKey } : {};

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    // Try to extract the server's error message so callers see the real reason
    // (e.g. "User with phone X already exists") instead of "API Error: 400 Bad Request".
    let detail: string | null = null;
    try {
      const text = await response.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string; message?: string };
          detail = parsed.error || parsed.message || text;
        } catch {
          detail = text;
        }
      }
    } catch {
      // ignore body read errors
    }
    throw new Error(detail || `API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
