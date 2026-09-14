/**
 * Task Board Service
 *
 * Handles CRUD operations for tasks and assignees.
 */

import type { Task, Assignee, CreateTaskData, UpdateTaskData, TaskFilters, WhatsNewResult, ReleaseCandidate } from '../types/task';

// Base URL for task API (uses same server as main app)
const getBaseURL = (): string => {
  // In development, use localhost; in production, use the deployed server
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  // Production: use relative path (same origin) or configure as needed
  return import.meta.env.VITE_API_URL || 'https://aspect-server-138665194481.us-central1.run.app';
};

// ─── API Helpers ─────────────────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseURL()}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// ─── Task Functions ──────────────────────────────────────────────────

/**
 * Get all tasks with optional filters
 */
export async function getTasks(filters?: TaskFilters): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.assignee) params.append('assignee', filters.assignee);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.priority) params.append('priority', filters.priority);
  if (filters?.domain) params.append('domain', filters.domain);

  const query = params.toString();
  const endpoint = `/api/tasks${query ? `?${query}` : ''}`;

  const data = await apiRequest<{ tasks: Task[] }>(endpoint, { method: 'GET' });

  // Transform dates
  return data.tasks.map(task => ({
    ...task,
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
  }));
}

/**
 * Get a single task by ID (fresh from server)
 */
export async function getTask(id: number): Promise<Task> {
  const data = await apiRequest<{ task: Task }>(`/api/tasks/${id}`, { method: 'GET' });
  return { ...data.task, createdAt: new Date(data.task.createdAt), updatedAt: new Date(data.task.updatedAt) };
}

/**
 * Create a new task
 */
export async function createTask(taskData: CreateTaskData): Promise<Task> {
  const data = await apiRequest<{ task: Task }>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(taskData),
  });

  return {
    ...data.task,
    createdAt: new Date(data.task.createdAt),
    updatedAt: new Date(data.task.updatedAt),
  };
}

/**
 * Update a task
 */
export async function updateTask(id: number, updates: UpdateTaskData): Promise<Task> {
  const updatedBy = localStorage.getItem('aspect_commenter_identity') || undefined;
  const data = await apiRequest<{ task: Task }>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...updates, updatedBy }),
  });

  return {
    ...data.task,
    createdAt: new Date(data.task.createdAt),
    updatedAt: new Date(data.task.updatedAt),
  };
}

/**
 * Delete a task
 */
export async function deleteTask(id: number): Promise<void> {
  await apiRequest<{ success: boolean }>(`/api/tasks/${id}`, {
    method: 'DELETE',
  });
}

// ─── Assignee Functions ──────────────────────────────────────────────

/**
 * Get all assignees
 */
export async function getAssignees(): Promise<Assignee[]> {
  const data = await apiRequest<{ assignees: Assignee[] }>('/api/assignees', {
    method: 'GET',
  });
  return data.assignees;
}

/**
 * Add a new assignee
 */
/**
 * Get task IDs that need attention from a specific identity
 */
export async function getNeedsAttention(identity: string): Promise<number[]> {
  return apiRequest<number[]>(`/api/tasks/needs-attention?identity=${encodeURIComponent(identity)}`);
}

// ─── Deploy Tracking ────────────────────────────────────────────────

/**
 * Mark a task as deployed
 */
export async function markDeployed(id: number, identity?: string): Promise<Task> {
  const data = await apiRequest<{ task: Task }>(`/api/tasks/${id}/deploy`, {
    method: 'POST',
    body: JSON.stringify({ identity }),
  });
  return { ...data.task, createdAt: new Date(data.task.createdAt), updatedAt: new Date(data.task.updatedAt) };
}

/**
 * What's New for one person: tasks deployed after their "seen until" watermark, newest first
 */
export async function getWhatsNew(identity: string): Promise<WhatsNewResult> {
  const data = await apiRequest<WhatsNewResult>(`/api/tasks/whats-new?identity=${encodeURIComponent(identity)}`);
  return { tasks: Array.isArray(data?.tasks) ? data.tasks : [], seenUntil: data?.seenUntil ?? null };
}

/**
 * "Got it" — move the person's watermark to the newest item they saw
 */
export async function markWhatsNewSeen(identity: string, until: string): Promise<void> {
  await apiRequest('/api/tasks/whats-new/seen', {
    method: 'POST',
    body: JSON.stringify({ identity, until }),
  });
}

// ─── Release ────────────────────────────────────────────────────────

/**
 * Tasks waiting for release (Done, not released since done, not marked Not for release)
 */
export async function getReleaseCandidates(): Promise<ReleaseCandidate[]> {
  const data = await apiRequest<{ tasks: ReleaseCandidate[] }>('/api/tasks/release-candidates');
  return data.tasks;
}

/**
 * Mark several tasks as released (deployed) at once
 */
export async function releaseTasks(taskIds: number[], identity?: string): Promise<number[]> {
  const data = await apiRequest<{ released: number[] }>('/api/tasks/release', {
    method: 'POST',
    body: JSON.stringify({ taskIds, identity }),
  });
  return data.released;
}

export async function addAssignee(name: string): Promise<Assignee> {
  const data = await apiRequest<{ assignee: Assignee }>('/api/assignees', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.assignee;
}
