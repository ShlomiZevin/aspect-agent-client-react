import { useState, useEffect } from 'react';
import type { Task, Assignee, CreateTaskData, TaskStatus, TaskPriority, TaskType } from '../../../types/task';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import styles from './TaskForm.module.css';

// All known domains in the system
const ALL_DOMAINS = ['freeda', 'aspect', 'banking', 'byline'];

interface TaskFormProps {
  task?: Task | null;
  assignees: Assignee[];
  currentDomain: string; // Current domain from URL (e.g., 'freeda', 'aspect')
  showAllDomains?: boolean; // When true, show all domain options (Ctrl+Shift+A mode)
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

export function TaskForm({ task, assignees, currentDomain, showAllDomains, onSubmit, onCancel, onDelete }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [type, setType] = useState<TaskType>('feature');
  const [domain, setDomain] = useState<string>('general');
  const [assignee, setAssignee] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [atRisk, setAtRisk] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Domain options: when showAllDomains is true, show all domains; otherwise current + general
  const domainOptions = showAllDomains
    ? [
        { value: 'general', label: 'General (Engine)' },
        ...ALL_DOMAINS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))
      ]
    : currentDomain && currentDomain !== 'general'
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
      setDueDate(task.dueDate || '');
      setAtRisk(task.atRisk || false);
      setIsCompleted(task.isCompleted || false);
      setTagsInput(task.tags.join(', '));
    } else {
      // Default to general for new tasks
      setDomain('general');
      setDueDate('');
      setAtRisk(false);
      setIsCompleted(false);
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
      dueDate: dueDate || undefined,
      atRisk,
      isCompleted,
      tags,
    });
  };

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h3>{task ? 'Edit Task' : 'New Task'}</h3>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className={styles.formBody}>
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

          <div className={styles.descriptionField}>
            <div className={styles.descriptionHeader}>
              <label>Description</label>
              <button
                type="button"
                className={styles.expandBtn}
                onClick={() => setIsExpanded(true)}
              >
                Expand
              </button>
            </div>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Optional description..."
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

            <div className={styles.field}>
              <label htmlFor="dueDate">Due Date</label>
              <input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.row2}>
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

            <div className={styles.checkboxField}>
              <label className={`${styles.checkboxLabel} ${atRisk ? styles.atRiskActive : ''}`}>
                <input
                  type="checkbox"
                  checked={atRisk}
                  onChange={(e) => setAtRisk(e.target.checked)}
                />
                <span className={styles.checkboxIcon}>⚠</span>
                At Risk
              </label>
            </div>

            {/* Only show "Completed" checkbox for done tasks */}
            {status === 'done' && (
              <div className={styles.checkboxField}>
                <label className={`${styles.checkboxLabel} ${isCompleted ? styles.completedActive : ''}`}>
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={(e) => setIsCompleted(e.target.checked)}
                  />
                  <span className={styles.checkboxIcon}>✓</span>
                  Completed
                </label>
              </div>
            )}
          </div>
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

      {/* Expanded description editor */}
      {isExpanded && (
        <div className={styles.expandedOverlay} onClick={() => setIsExpanded(false)}>
          <div className={styles.expandedEditor} onClick={(e) => e.stopPropagation()}>
            <div className={styles.expandedHeader}>
              <h4>Edit Description</h4>
              <button type="button" className={styles.closeBtn} onClick={() => setIsExpanded(false)}>
                ×
              </button>
            </div>
            <div className={styles.expandedContent}>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Write your description..."
                expanded
              />
            </div>
            <div className={styles.expandedActions}>
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => setIsExpanded(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
