import type { TaskComment } from '../types/task';

const getBaseURL = (): string => {
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return import.meta.env.VITE_API_URL || 'https://aspect-server-138665194481.us-central1.run.app';
};

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseURL()}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

export async function getComments(taskId: number): Promise<TaskComment[]> {
  const data = await apiRequest<{ comments: TaskComment[] }>(`/api/tasks/${taskId}/comments`);
  return data.comments;
}

export async function addComment(taskId: number, author: string, content: string): Promise<TaskComment> {
  const data = await apiRequest<{ comment: TaskComment }>(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ author, content }),
  });
  return data.comment;
}

export async function deleteComment(taskId: number, commentId: number): Promise<void> {
  await apiRequest(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
}
