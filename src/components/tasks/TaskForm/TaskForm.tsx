import { useState, useEffect } from 'react';
import type { Task, Assignee, CreateTaskData, TaskStatus, TaskPriority, TaskType } from '../../../types/task';
import styles from './TaskForm.module.css';

interface TaskFormProps {
  task?: Task | null;
  assignees: Assignee[];
  currentDomain: string; // Current domain from URL (e.g., 'freeda', 'aspect')
  onSubmit: (data: CreateTaskData) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'idea', label: 'Idea' },
];

export function TaskForm({ task, assignees, currentDomain, onSubmit, onCancel, onDelete }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [type, setType] = useState<TaskType>('feature');
  const [domain, setDomain] = useState<string>('general');
  const [assignee, setAssignee] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');

  // Domain options: always 'general' + current domain if not general
  const domainOptions = currentDomain && currentDomain !== 'general'
    ? [{ value: 'general', label: 'General (Engine)' }, { value: currentDomain, label: currentDomain.charAt(0).toUpperCase() + currentDomain.slice(1) }]
    : [{ value: 'general', label: 'General (Engine)' }];

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setType(task.type);
      setDomain(task.domain || 'general');
      setAssignee(task.assignee || '');
      setTagsInput(task.tags.join(', '));
    } else {
      // Default to general for new tasks
      setDomain('general');
    }
  }, [task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
      type,
      domain,
      assignee: assignee || undefined,
      tags,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h3>{task ? 'Edit Task' : 'New Task'}</h3>
        <button type="button" className={styles.closeBtn} onClick={onCancel}>
          ×
        </button>
      </div>

      <div className={styles.field}>
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          autoFocus
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={3}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="type">Type</label>
          <select id="type" value={type} onChange={(e) => setType(e.target.value as TaskType)}>
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="priority">Priority</label>
          <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {PRIORITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="status">Status</label>
          <select id="status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="domain">Domain</label>
          <select id="domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
            {domainOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="assignee">Assignee</label>
          <select id="assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {assignees.map(a => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="tags">Tags (comma-separated)</label>
        <input
          id="tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g., urgent, backend, ui"
        />
      </div>

      <div className={styles.actions}>
        {task && onDelete && (
          <button type="button" className={styles.deleteBtn} onClick={onDelete}>
            Delete
          </button>
        )}
        <div className={styles.rightActions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={styles.submitBtn}>
            {task ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </form>
  );
}
