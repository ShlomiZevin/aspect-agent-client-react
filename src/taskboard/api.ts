/**
 * HTTP client for /api/taskboard/*.
 *
 * One `request` helper, one place that knows the base URL, and every call typed
 * by what it returns. The old board had two copies of this helper in two service
 * files that had already drifted apart.
 */
import { getBaseURL } from '../services/api';
import type { Comment, Notification, Person, Task, TaskDraft, TaskStatus, TaskPriority, TaskType } from './types';

// getBaseURL() rather than another copy of the Cloud Run URL: a second copy is
// how a local build ends up silently talking to production, which this repo has
// been bitten by before. The DEV branch stays because the board talks to the
// local server directly, as the existing one does.
const ROOT = () => `${import.meta.env.DEV ? 'http://localhost:3000' : getBaseURL()}/api/taskboard`;

/**
 * Thrown for any non-2xx, carrying the status so callers can tell a 404 from a
 * 500. The shared `apiRequest` throws a bare Error, which is why this feature
 * has its own thin wrapper: "the task is gone, drop it from the list" and "the
 * server is broken, keep it and show a banner" are different reactions.
 */
export class ApiError extends Error {
  // Declared as a field rather than a constructor parameter property: this repo
  // builds with `erasableSyntaxOnly`, which forbids the shorthand.
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ROOT()}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });

  if (!res.ok) {
    // The server answers errors as { error }, but a proxy or a crash can return
    // HTML, so the parse is allowed to fail rather than masking the real status.
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.error || `${res.status} ${res.statusText}`, res.status);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

function qs(params: object): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    // Skips undefined, '' and false so an unset filter contributes no key at
    // all — `?openOnly=false` would otherwise read as a filter that is on.
    if (v !== undefined && v !== null && v !== '' && v !== false) out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

export interface TaskQuery {
  status?: TaskStatus;
  assignee?: string;
  type?: TaskType;
  priority?: TaskPriority;
  tag?: string;
  openOnly?: boolean;
}

export const api = {
  // --- tasks ---------------------------------------------------------------
  listTasks: (q: TaskQuery = {}) =>
    request<{ tasks: Task[] }>(`/tasks${qs(q)}`).then(r => r.tasks),

  getTask: (id: number) =>
    request<{ task: Task }>(`/tasks/${id}`).then(r => r.task),

  createTask: (draft: TaskDraft) =>
    request<{ task: Task }>('/tasks', { method: 'POST', body: JSON.stringify(draft) })
      .then(r => r.task),

  updateTask: (id: number, patch: TaskDraft) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      .then(r => r.task),

  deleteTask: (id: number) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }).then(() => undefined),

  markDeployed: (id: number) =>
    request<{ task: Task }>(`/tasks/${id}/deploy`, { method: 'POST' }).then(r => r.task),

  // --- what's new ----------------------------------------------------------
  whatsNew: (person: string) =>
    request<{ tasks: Task[] }>(`/tasks/whats-new${qs({ person })}`).then(r => r.tasks),

  dismiss: (id: number, person: string) =>
    request<{ success: boolean }>(`/tasks/${id}/dismiss`, {
      method: 'POST', body: JSON.stringify({ person }),
    }).then(() => undefined),

  needsAttention: (person: string) =>
    request<{ taskIds: number[] }>(`/tasks/needs-attention${qs({ person })}`).then(r => r.taskIds),

  // --- comments ------------------------------------------------------------
  listComments: (taskId: number) =>
    request<{ comments: Comment[] }>(`/tasks/${taskId}/comments`).then(r => r.comments),

  addComment: (taskId: number, author: string, body: string) =>
    request<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
      method: 'POST', body: JSON.stringify({ author, body }),
    }).then(r => r.comment),

  deleteComment: (commentId: number) =>
    request<{ success: boolean }>(`/comments/${commentId}`, { method: 'DELETE' })
      .then(() => undefined),

  toggleLike: (commentId: number, person: string) =>
    request<{ comment: Comment }>(`/comments/${commentId}/like`, {
      method: 'POST', body: JSON.stringify({ person }),
    }).then(r => r.comment),

  // --- people and notifications --------------------------------------------
  listPeople: () => request<{ people: Person[] }>('/people').then(r => r.people),

  addPerson: (name: string) =>
    request<{ person: Person }>('/people', { method: 'POST', body: JSON.stringify({ name }) })
      .then(r => r.person),

  notifications: (person: string) =>
    request<{ notifications: Notification[] }>(`/notifications${qs({ person })}`)
      .then(r => r.notifications),

  markNotificationsRead: (person: string, ids?: number[]) =>
    request<{ marked: number }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids ? { person, ids } : { person, all: true }),
    }).then(r => r.marked),

  /**
   * Hebrew <-> English, direction detected from the text.
   *
   * Returns the translation and never stores it: a translation is a reading
   * aid, and keeping one on the task would mean two versions of a title that
   * drift apart the next time someone edits one of them.
   */
  translate: (text: string) =>
    request<{ translated: string; to: 'he' | 'en' }>('/translate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  /**
   * Whether the board is switched on for this client.
   *
   * Reads the PUBLIC module status (`GET /api/modules/:client`), not the admin
   * one: this runs for whoever opens the board, and the admin shape carries
   * settings, the binding and the init model id.
   */
  isEnabledFor: async (client: string): Promise<boolean> => {
    const base = import.meta.env.DEV ? 'http://localhost:3000' : getBaseURL();
    const res = await fetch(`${base}/api/modules/${encodeURIComponent(client)}`);
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return Boolean(body?.modules?.some((m: { id: string }) => m.id === 'taskboard'));
  },

  /** URL for the SSE stream. Not fetched here — EventSource opens it itself. */
  streamUrl: () => `${ROOT()}/stream`,
};
