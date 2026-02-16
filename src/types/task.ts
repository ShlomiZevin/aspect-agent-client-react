export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'bug' | 'feature' | 'idea';

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
  tags: string[];
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
  assignee?: string;
  dueDate?: string;
  tags?: string[];
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
  tags?: string[];
}

export interface TaskFilters {
  status?: TaskStatus;
  assignee?: string;
  type?: TaskType;
  priority?: TaskPriority;
  domain?: string;
}
