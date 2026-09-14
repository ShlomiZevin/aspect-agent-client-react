export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'task' | 'bug' | 'feature' | 'idea' | 'goal' | 'agenda' | 'read' | 'test';

export interface Assignee {
  id: number;
  name: string;
  seenUntil?: string | null; // What's New watermark; null = no popup
  createdAt?: Date;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  domain: string; // 'general', 'freeda', 'aspect', etc.
  assignee?: string;
  dueDate?: string; // ISO date string
  atRisk: boolean; // Flag for tasks at risk of missing deadline
  isCompleted: boolean; // PM approval - task fully completed and reviewed
  dependsOn?: number; // ID of task this depends on (must be done first)
  linkedTasks?: number[]; // IDs of related tasks (not blocking)
  tags: string[];
  crewMember?: string; // Crew member related to this task
  isDraft: boolean; // Draft mode - only visible to creator
  createdBy?: string; // Browser-based user identifier
  opener?: string; // Human-readable name of who opened the task ("who you are" identity)
  deployedAt?: string; // When task was deployed to production
  deployedReviewedBy?: string[]; // Users who dismissed from "What's New"
  doneAt?: string | null; // When the task last moved to Done
  notForRelease?: boolean; // Excluded from the Release list
  whatChanged?: string | null; // Assignee's plain-language note: what changed, what to check
  whatsNewHeadline?: string | null; // One line shown in the What's New popup
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  domain?: string;
  assignee?: string | null;
  dueDate?: string;
  atRisk?: boolean;
  isCompleted?: boolean;
  dependsOn?: number | null; // null to clear dependency
  linkedTasks?: number[];
  tags?: string[];
  crewMember?: string | null;
  isDraft?: boolean;
  createdBy?: string;
  opener?: string;
  updatedBy?: string;
  whatChanged?: string | null;
  whatsNewHeadline?: string | null;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  type?: TaskType;
  domain?: string;
  assignee?: string | null;
  dueDate?: string | null;
  atRisk?: boolean;
  isCompleted?: boolean;
  dependsOn?: number | null;
  linkedTasks?: number[];
  tags?: string[];
  crewMember?: string | null;
  isDraft?: boolean;
  createdBy?: string;
  whatChanged?: string | null;
  whatsNewHeadline?: string | null;
  notForRelease?: boolean;
}

/** One line in the What's New popup */
export interface WhatsNewItem {
  id: number;
  title: string;
  whatsNewHeadline?: string | null;
  whatChanged?: string | null;
  deployedAt: string;
}

export interface WhatsNewResult {
  tasks: WhatsNewItem[];
  seenUntil: string | null;
}

/** One row in the Release window */
export interface ReleaseCandidate {
  id: number;
  title: string;
  type: TaskType;
  assignee?: string | null;
  doneAt?: string | null;
  whatsNewHeadline?: string | null;
  whatChanged?: string | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  assignee?: string;
  type?: TaskType;
  priority?: TaskPriority;
  domain?: string;
  crewMember?: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  author: string;
  content: string;
  likedBy?: string[];
  createdAt: string;
  updatedAt: string;
}
