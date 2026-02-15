import type { Task } from '../../../types/task';
import styles from './TaskList.module.css';

interface TaskListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const TYPE_LABELS: Record<string, string> = {
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

export function TaskList({ tasks, onTaskClick, onDeleteTask }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className={styles.empty}>
        No tasks yet. Click "+ Add Task" to create one.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Title</th>
            <th>Domain</th>
            <th>Type</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} onClick={() => onTaskClick(task)}>
              <td className={styles.titleCell}>
                <span className={styles.title}>{task.title}</span>
                {task.description && (
                  <span className={styles.description}>{task.description}</span>
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
