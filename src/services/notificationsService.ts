export interface TaskNotification {
  id: number;
  recipient: string;
  taskId: number;
  commentId: number | null;
  type: 'mention' | 'comment_on_assigned' | 'assigned' | 'status_changed';
  isDelivered: boolean; // false = NEW (not yet delivered to client before this fetch)
  createdAt: string;
}

const getBaseURL = (): string => {
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return import.meta.env.VITE_API_URL || 'https://aspect-agent-server-1018338671074.europe-west1.run.app';
};

export const API_BASE = getBaseURL();

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseURL()}${endpoint}`, {
    ...options,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

export async function getNotifications(identity: string): Promise<TaskNotification[]> {
  const data = await apiRequest<{ notifications: TaskNotification[] }>(
    `/api/notifications?identity=${encodeURIComponent(identity)}`
  );
  return data.notifications;
}
