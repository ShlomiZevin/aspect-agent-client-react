/**
 * Types for the Aspect task board.
 *
 * Separate from src/types/task.ts on purpose: that describes LYBI's board, which
 * is a different tool against a different database. They will drift, and they
 * should be allowed to.
 */

export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const TYPES = ['task', 'bug', 'feature', 'idea', 'goal', 'agenda', 'read', 'test'] as const;

/**
 * Domains, and the labels the original board shows for them. Kept as the same
 * list so a task filed here reads the same as one filed there.
 */
export const DOMAINS: { value: string; label: string }[] = [
  { value: 'general', label: 'General (Engine)' },
  { value: 'aspect', label: 'Aspect' },
  { value: 'freeda', label: 'Freeda' },
  { value: 'freeda-1.0', label: 'Freeda-1.0' },
  { value: 'banking', label: 'Banking' },
  { value: 'byline', label: 'Byline' },
];

/** Title Case labels, as the original form shows them — not raw enum values. */
export const LABELS: Record<string, string> = {
  todo: 'Todo', in_progress: 'In Progress', done: 'Done',
  low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
  task: 'Task', feature: 'Feature', bug: 'Bug', idea: 'Idea',
  test: 'Test', read: 'Read', goal: 'Goal', agenda: 'Agenda',
};

export type TaskStatus = (typeof STATUSES)[number];
export type TaskPriority = (typeof PRIORITIES)[number];
export type TaskType = (typeof TYPES)[number];

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assignee?: string;
  opener?: string;
  dueDate?: string;
  tags: string[];
  /** Someone judged this is slipping. Not derived from dueDate — see the migration. */
  atRisk: boolean;
  /** For `read` tasks: the assignee has actually read it. Not the same as done. */
  acknowledged: boolean;
  isDraft: boolean;
  /** Which part of the product this belongs to. A label, not a boundary. */
  domain: string;
  /** The crew member a task is about; free text, the list is per agent. */
  crewMember?: string;
  dependsOn?: number;
  linkedTaskIds: number[];
  deployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** What a create or update accepts. The server ignores anything else. */
export type TaskDraft = Partial<
  Pick<
    Task,
    'title' | 'description' | 'status' | 'priority' | 'type' | 'assignee' | 'opener'
    | 'dueDate' | 'tags' | 'atRisk' | 'acknowledged' | 'isDraft' | 'dependsOn' | 'linkedTaskIds'
    | 'domain' | 'crewMember'
  >
>;

export interface Comment {
  id: number;
  taskId: number;
  author: string;
  body: string;
  likedBy: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  name: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  taskId: number;
  commentId?: number;
  type: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  createdAt: string;
}

/**
 * Live board events.
 *
 * A discriminated union rather than `{ type: string; payload: unknown }` so a
 * handler that forgets a case fails to compile instead of silently ignoring it.
 */
export type BoardEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'task_deleted'; taskId: number }
  | { type: 'comment_added'; taskId: number; comment: Comment }
  | { type: 'comment_updated'; taskId: number; comment: Comment }
  | { type: 'comment_deleted'; commentId: number };
