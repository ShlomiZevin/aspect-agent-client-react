import type { Task } from '../../../types/task';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
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

export function TaskCard({ task, onClick }: TaskCardProps) {
  return (
    <div className={styles.card} onClick={onClick}>
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
        <p className={styles.description}>{task.description}</p>
      )}
      <div className={styles.footer}>
        {task.assignee && (
          <span className={styles.assignee}>@{task.assignee}</span>
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
