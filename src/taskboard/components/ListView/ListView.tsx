import type { Task } from '../../types';
import styles from './ListView.module.css';

/**
 * The board as a table. Markup and stylesheet are the original board's.
 *
 * The Domain and Crew columns are gone with the fields behind them; the
 * per-column filter dropdowns are gone too, because filtering already lives in
 * the toolbar above and having the same filter in two places is how two filters
 * end up disagreeing.
 */
interface Props {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
}

const TYPE_LABELS: Record<string, string> = {
  task: 'Task', bug: 'Bug', feature: 'Feature', idea: 'Idea',
  goal: 'Goal', agenda: 'Agenda', read: 'Read', test: 'Test',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low', medium: 'Med', high: 'High', critical: 'Crit',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo', in_progress: 'In Progress', done: 'Done',
};

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function containsHebrew(text: string): boolean {
  return /[֐-׿]/.test(text);
}

function formatDueDate(dateStr?: string): { text: string; isOverdue: boolean } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isOverdue = dateOnly < today;
  if (dateOnly.getTime() === today.getTime()) return { text: 'Today', isOverdue: false };
  if (dateOnly.getTime() === tomorrow.getTime()) return { text: 'Tomorrow', isOverdue: false };
  return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), isOverdue };
}

function formatCreatedAt(date: string): string {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const created = new Date(d);
  created.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - created.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ListView({ tasks, onTaskClick, onDeleteTask }: Props) {
  if (tasks.length === 0) {
    return <div className={styles.empty}>No tasks yet. Click &quot;New Task&quot; to create one.</div>;
  }

  return (
    <div className={styles.tableWrapper} dir="ltr">
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.titleCol}>Title</th>
            <th>Type</th>
            <th>Assignee</th>
            <th>Priority</th>
            <th>Due</th>
            <th>Created</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => {
            const due = formatDueDate(task.dueDate);
            return (
              <tr
                key={task.id}
                className={[task.atRisk && styles.atRiskRow, task.acknowledged && styles.completedRow]
                  .filter(Boolean).join(' ')}
                onClick={() => onTaskClick(task)}
              >
                <td className={styles.titleCell}>
                  <span className={styles.titleWrapper}>
                    {task.atRisk && <span className={styles.atRiskIcon}>⚠</span>}
                    <span
                      className={styles.title}
                      style={containsHebrew(task.title) ? { direction: 'rtl', textAlign: 'right' } : undefined}
                    >
                      {task.title}
                    </span>
                  </span>
                  {task.description && (
                    <span className={styles.description}>{stripHtml(task.description)}</span>
                  )}
                  {/* Repeated inside the title cell for narrow screens, where the
                      dedicated columns below are hidden by the stylesheet. */}
                  <span className={styles.mobileMeta}>
                    {task.assignee && <span className={styles.assignee}>@{task.assignee}</span>}
                    <span className={`${styles.priority} ${styles[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                    <span className={`${styles.status} ${styles[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                  </span>
                </td>
                <td><span className={`${styles.badge} ${styles[task.type]}`}>{TYPE_LABELS[task.type]}</span></td>
                <td className={styles.mobileShow}>
                  {task.assignee
                    ? <span className={styles.assignee}>@{task.assignee}</span>
                    : <span className={styles.unassigned}>—</span>}
                </td>
                <td className={styles.mobileShow}>
                  <span className={`${styles.priority} ${styles[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                </td>
                <td>
                  {due
                    ? <span className={`${styles.dueDate} ${due.isOverdue ? styles.overdue : ''}`}>{due.text}</span>
                    : <span className={styles.noDueDate}>—</span>}
                </td>
                <td>
                  {task.createdAt
                    ? <span className={styles.createdAt}>{formatCreatedAt(task.createdAt)}</span>
                    : <span className={styles.noDueDate}>—</span>}
                </td>
                <td className={styles.mobileShow}>
                  <span className={`${styles.status} ${styles[task.status]}`}>{STATUS_LABELS[task.status]}</span>
                </td>
                <td className={styles.deleteCell}>
                  <button
                    className={styles.deleteBtn}
                    onClick={e => { e.stopPropagation(); onDeleteTask(task); }}
                    title="Delete"
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
