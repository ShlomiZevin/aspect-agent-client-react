/**
 * Comments on agenda lines — the meeting's action items (/tasks/actions and
 * the center's ACTION ITEMS panel). Server: routes/agenda-comments.routes.js.
 *
 * A comment points at its line's stable id (`lineKey`), which the server
 * stamps at the end of the line the first time someone comments on it. New
 * comments address the line like a tick: index AND text (409 when it moved).
 */
import type { Task } from '../types/task';
import { API_BASE } from './notificationsService';

export interface AgendaComment {
  id: number;
  taskId: number;
  lineKey: string;
  lineText: string;
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API Error: ${res.status}`);
  }
  return res.json();
}

function withDates(task: Task): Task {
  return { ...task, createdAt: new Date(task.createdAt), updatedAt: new Date(task.updatedAt) };
}

export async function listAgendaComments(taskIds: number[]): Promise<AgendaComment[]> {
  if (taskIds.length === 0) return [];
  const data = await request<{ comments: AgendaComment[] }>(`/api/agenda-comments?taskIds=${taskIds.join(',')}`);
  return data.comments;
}

export async function addAgendaComment(input: {
  taskId: number; index: number; text: string; author: string; body: string;
}): Promise<{ comment: AgendaComment; task: Task }> {
  const data = await request<{ comment: AgendaComment; task: Task }>('/api/agenda-comments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return { comment: data.comment, task: withDates(data.task) };
}

export async function editAgendaComment(id: number, author: string, body: string): Promise<AgendaComment> {
  const data = await request<{ comment: AgendaComment }>(`/api/agenda-comments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ author, body }),
  });
  return data.comment;
}

export async function deleteAgendaComment(id: number, author: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/agenda-comments/${id}?author=${encodeURIComponent(author)}`, { method: 'DELETE' });
}
