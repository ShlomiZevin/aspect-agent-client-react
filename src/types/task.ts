export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'task' | 'bug' | 'feature' | 'idea';

export interface Assignee {
  id: number;
  name: string;
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
  tags: string[];
  crewMember?: string; // Crew member related to this task
  isDraft: boolean; // Draft mode - only visible to creator
  createdBy?: string; // Browser-based user identifier
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
  tags?: string[];
  crewMember?: string | null;
  isDraft?: boolean;
  createdBy?: string;
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
  tags?: string[];
  crewMember?: string | null;
  isDraft?: boolean;
  createdBy?: string;
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
  createdAt: string;
  updatedAt: string;
}
