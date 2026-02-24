import type { Task } from '../../../types/task';
import styles from './TaskList.module.css';

interface TaskListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  // Draft selection props
  showDraftCheckboxes?: boolean;
  selectedDrafts?: Set<number>;
  onToggleDraftSelection?: (taskId: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  task: 'Task',
  bug: 'Bug',
  feature: 'Feature',
  idea: 'Idea',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

// Format due date for display
function formatDueDate(dueDate: string | Date | null | undefined): { text: string; isOverdue: boolean } | null {
  if (!dueDate) return null;

  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDay = new Date(date);
  dueDay.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;

  let text: string;
  if (diffDays === 0) {
    text = 'Today';
  } else if (diffDays === 1) {
    text = 'Tomorrow';
  } else if (diffDays === -1) {
    text = 'Yesterday';
  } else if (diffDays < -1) {
    text = `${Math.abs(diffDays)} days ago`;
  } else if (diffDays <= 7) {
    text = `In ${diffDays} days`;
  } else {
    text = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return { text, isOverdue };
}

// Strip HTML tags for plain text preview
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// Check if text contains Hebrew characters
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

export function TaskList({ tasks, onTaskClick, onDeleteTask, showDraftCheckboxes, selectedDrafts, onToggleDraftSelection }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        No tasks yet. Click "+ Add Task" to create one.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper} dir="ltr">
      <table className={styles.table}>
        <thead>
          <tr>
            {showDraftCheckboxes && <th className={styles.checkboxCol}></th>}
            <th>Title</th>
            <th>Domain</th>
            <th>Type</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} className={task.atRisk ? styles.atRiskRow : ''} onClick={() => onTaskClick(task)}>
              {showDraftCheckboxes && (
                <td className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={selectedDrafts?.has(task.id) || false}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleDraftSelection?.(task.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={styles.draftCheckbox}
                  />
                </td>
              )}
              <td className={styles.titleCell}>
                <span className={styles.titleWrapper}>
                  {task.atRisk && <span className={styles.atRiskIcon}>⚠</span>}
                  <span className={styles.title} style={containsHebrew(task.title) ? { direction: 'rtl', textAlign: 'right' } : undefined}>{task.title}</span>
                </span>
                {task.description && (
                  <span className={styles.description}>{stripHtml(task.description)}</span>
                )}
              </td>
              <td>
                <span className={styles.domain}>
                  {task.domain === 'general' ? 'General' : task.domain.charAt(0).toUpperCase() + task.domain.slice(1)}
                </span>
              </td>
              <td>
                <span className={`${styles.badge} ${styles[task.type]}`}>
                  {TYPE_LABELS[task.type]}
                </span>
              </td>
              <td>
                {task.assignee ? (
                  <span className={styles.assignee}>@{task.assignee}</span>
                ) : (
                  <span className={styles.unassigned}>—</span>
                )}
              </td>
              <td>
                <span className={`${styles.priority} ${styles[task.priority]}`}>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              </td>
              <td>
                {(() => {
                  const due = formatDueDate(task.dueDate);
                  if (!due) return <span className={styles.noDueDate}>—</span>;
                  return (
                    <span className={`${styles.dueDate} ${due.isOverdue ? styles.overdue : ''}`}>
                      {due.text}
                    </span>
                  );
                })()}
              </td>
              <td>
                <span className={`${styles.status} ${styles[task.status]}`}>
                  {STATUS_LABELS[task.status]}
                </span>
              </td>
              <td>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTask(task);
                  }}
                  title="Delete task"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
