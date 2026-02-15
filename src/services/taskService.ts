/**
 * Task Board Service
 *
 * Handles CRUD operations for tasks and assignees.
 */

import type { Task, Assignee, CreateTaskData, UpdateTaskData, TaskFilters } from '../types/task';

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
  const data = await apiRequest<{ task: Task }>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
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
export async function addAssignee(name: string): Promise<Assignee> {
  const data = await apiRequest<{ assignee: Assignee }>('/api/assignees', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.assignee;
}
