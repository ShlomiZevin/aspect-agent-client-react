import type { Task } from '../../../types/task';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onAtRiskToggle?: (taskId: number, atRisk: boolean) => void;
}

const TYPE_ICONS: Record<string, string> = {
  bug: 'BUG',
  feature: 'FEATURE',
  idea: 'IDEA',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#10b981',      // green
  medium: '#f59e0b',   // yellow
  high: '#f97316',     // orange
  critical: '#ef4444', // red
};

// Strip HTML tags for plain text preview
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// Format date for display
function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) return 'Today';
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if date is overdue
function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

export function TaskCard({ task, onClick, onAtRiskToggle }: TaskCardProps) {
  const handleAtRiskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAtRiskToggle?.(task.id, !task.atRisk);
  };

  return (
    <div className={`${styles.card} ${task.atRisk ? styles.atRisk : ''}`} onClick={onClick}>
      {/* At Risk toggle - visible on hover */}
      {onAtRiskToggle && (
        <button
          className={`${styles.atRiskToggle} ${task.atRisk ? styles.active : ''}`}
          onClick={handleAtRiskClick}
          title={task.atRisk ? 'Remove at risk flag' : 'Mark as at risk'}
        >
          ⚠
        </button>
      )}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={`${styles.type} ${styles[task.type]}`}>
            {TYPE_ICONS[task.type] || task.type.toUpperCase()}
          </span>
          {task.domain && task.domain !== 'general' && (
            <span className={styles.domain}>{task.domain}</span>
          )}
        </div>
        <span
          className={styles.priority}
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        >
          {task.priority.toUpperCase()}
        </span>
      </div>
      <h4 className={styles.title}>{task.title}</h4>
      {task.description && (
        <p className={styles.description}>{stripHtml(task.description)}</p>
      )}
      <div className={styles.footer}>
        {task.assignee && (
          <span className={styles.assignee}>@{task.assignee}</span>
        )}
        {task.dueDate && (
          <span className={`${styles.dueDate} ${isOverdue(task.dueDate) ? styles.overdue : ''}`}>
            {formatDueDate(task.dueDate)}
          </span>
        )}
        {task.tags.length > 0 && (
          <div className={styles.tags}>
            {task.tags.slice(0, 2).map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
            {task.tags.length > 2 && (
              <span className={styles.tag}>+{task.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
