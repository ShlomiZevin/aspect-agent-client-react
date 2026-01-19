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

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
