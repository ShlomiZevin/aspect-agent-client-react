import type { Task } from '../../../types/task';
import styles from './TaskCard.module.css';

interface TaskCardProps {
  task: Task;
  dependencyInfo?: { name: string; satisfied: boolean }; // Info about task dependency
  crewDisplayNames?: Record<string, string>;
  onClick?: () => void;
  onAtRiskToggle?: (taskId: number, atRisk: boolean) => void;
  onMarkComplete?: (taskId: number, isCompleted: boolean) => void;
}

const TYPE_ICONS: Record<string, string> = {
  task: 'TASK',
  bug: 'BUG',
  feature: 'FEATURE',
  idea: 'IDEA',
  goal: 'GOAL',
  agenda: 'AGENDA',
  read: 'READ',
  test: 'TEST',
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

// Check if text contains Hebrew characters
function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
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

// Format creation date for display
function formatCreatedAt(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const created = new Date(d);
  created.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if date is overdue
function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Manual color assignments for known assignees - maximally distinct
const KNOWN_ASSIGNEE_COLORS: Record<string, string> = {
  'shlomi': '#FB8C00',  // Orange
  'kosta': '#1E88E5',   // Blue
  'noa': '#E53935',     // Red
};

// Extended color palette for other assignees - 16 highly distinct colors
const ASSIGNEE_COLORS = [
  '#43A047', // Green
  '#8E24AA', // Purple
  '#00ACC1', // Cyan
  '#D81B60', // Pink
  '#6D4C41', // Brown
  '#3949AB', // Indigo
  '#00897B', // Teal
  '#C0CA33', // Lime
  '#F4511E', // Deep Orange
  '#5E35B1', // Deep Purple
  '#039BE5', // Light Blue
  '#7CB342', // Light Green
  '#546E7A', // Blue Grey
  '#FFB300', // Amber
  '#EC407A', // Pink 400
  '#26A69A', // Teal 400
];

// FNV-1a hash - better distribution than simple sum
function fnv1aHash(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned
  }
  return hash;
}

function getAssigneeColor(assignee: string): string {
  const name = assignee.toLowerCase();
  // Use manual assignment for known assignees
  if (KNOWN_ASSIGNEE_COLORS[name]) {
    return KNOWN_ASSIGNEE_COLORS[name];
  }
  // Fall back to hash for unknown assignees
  const hash = fnv1aHash(name);
  return ASSIGNEE_COLORS[hash % ASSIGNEE_COLORS.length];
}

export function TaskCard({ task, dependencyInfo, crewDisplayNames, onClick, onAtRiskToggle, onMarkComplete }: TaskCardProps) {
  const isOrphan = !task.assignee;
  const isLimbo = task.assignee === 'Limbo';
  const assigneeColor = task.assignee && !isLimbo ? getAssigneeColor(task.assignee) : undefined;

  const handleAtRiskClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAtRiskToggle?.(task.id, !task.atRisk);
  };

  const handleMarkCompleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkComplete?.(task.id, !task.isCompleted);
  };

  // Inline styles for assigned tasks with dynamic color
  const cardStyle = assigneeColor ? {
    '--assignee-color': assigneeColor,
  } as React.CSSProperties : undefined;

  return (
    <div
      className={`${styles.card} ${task.atRisk ? styles.atRisk : ''} ${task.isCompleted ? styles.completed : ''} ${isLimbo ? styles.limbo : isOrphan ? styles.orphan : styles.assigned} ${task.isDraft ? styles.draft : ''}`}
      style={cardStyle}
      onClick={onClick}
    >
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
      {/* Mark Complete button - only for done tasks */}
      {onMarkComplete && task.status === 'done' && (
        <button
          className={`${styles.markCompleteBtn} ${task.isCompleted ? styles.active : ''}`}
          onClick={handleMarkCompleteClick}
          title={task.isCompleted ? 'Unmark as completed' : 'Mark as completed (PM approved)'}
        >
          ✓
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
          {task.crewMember && (
            <span className={styles.crewMember}>{crewDisplayNames?.[task.crewMember] || task.crewMember}</span>
          )}
          {dependencyInfo && (
            <span
              className={`${styles.dependency} ${dependencyInfo.satisfied ? styles.satisfied : styles.blocked}`}
              title={`Depends on: ${dependencyInfo.name}${dependencyInfo.satisfied ? ' (done)' : ' (not done)'}`}
            >
              {dependencyInfo.satisfied ? '🔗' : '🔒'}
            </span>
          )}
        </div>
        <span
          className={styles.priority}
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        >
          {task.priority.toUpperCase()}
        </span>
      </div>
      <h4 className={styles.title} style={containsHebrew(task.title) ? { direction: 'rtl', textAlign: 'right' } : undefined}>{task.title}</h4>
      {task.description && (
        <p className={styles.description}>{stripHtml(task.description)}</p>
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
      <div className={styles.footer}>
        {(task.assignee || task.opener) && (
          <span className={styles.assignee} style={{ color: assigneeColor }}>
            {task.assignee && `@${task.assignee}`}
            {task.opener && <span className={styles.opener}>{task.assignee ? ' ' : ''}By {task.opener.startsWith('user_') || task.opener.startsWith('anon_') ? 'Anon' : task.opener}</span>}
          </span>
        )}
        <div className={styles.footerRight}>
          {task.createdAt && (
            <span className={styles.createdAt}>{formatCreatedAt(task.createdAt)}</span>
          )}
          <span className={`${styles.dueDate} ${task.dueDate && isOverdue(task.dueDate) ? styles.overdue : ''}`}>
            {task.dueDate ? formatDueDate(task.dueDate) : 'not urgent'}
          </span>
        </div>
      </div>
    </div>
  );
}
