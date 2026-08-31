import type { Task } from '../../types';
import styles from './TaskCard.module.css';

/**
 * A task card. Markup and stylesheet are the original board's, unchanged, so
 * the two look the same.
 *
 * Two fields are gone rather than ported: `domain` duplicated a boundary the
 * module already has — this board is switched on per client, and the client is
 * the database it lives in — and `crewMember` describes a crew member of the
 * client's conversational agent, which is not what our work is about.
 *
 * `isCompleted` is `acknowledged` here: it never meant "done", it meant the
 * assignee had read it, and sitting next to `status` as a second done-looking
 * flag is what made it ambiguous.
 */
interface TaskCardProps {
  task: Task;
  dependencyInfo?: { name: string; satisfied: boolean };
  onClick?: () => void;
  onAtRiskToggle?: (taskId: number, atRisk: boolean) => void;
  onMarkComplete?: (taskId: number, acknowledged: boolean) => void;
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
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

/** Descriptions are HTML; the card shows a plain-text preview of one line. */
function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function containsHebrew(text: string): boolean {
  return /[֐-׿]/.test(text);
}

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

function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Fixed colours for the people who are on nearly every card, so their cards are
// recognisable at a glance rather than merely distinct.
const KNOWN_ASSIGNEE_COLORS: Record<string, string> = {
  shlomi: '#FB8C00',
  kosta: '#1E88E5',
  noa: '#E53935',
};

const ASSIGNEE_COLORS = [
  '#43A047', '#8E24AA', '#00ACC1', '#D81B60', '#6D4C41', '#3949AB',
  '#00897B', '#C0CA33', '#F4511E', '#5E35B1', '#039BE5', '#7CB342',
  '#546E7A', '#FFB300', '#EC407A', '#26A69A',
];

/** FNV-1a: spreads short similar names far better than summing char codes. */
function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function getAssigneeColor(assignee: string): string {
  const name = assignee.toLowerCase();
  if (KNOWN_ASSIGNEE_COLORS[name]) return KNOWN_ASSIGNEE_COLORS[name];
  return ASSIGNEE_COLORS[fnv1aHash(name) % ASSIGNEE_COLORS.length];
}

export function TaskCard({ task, dependencyInfo, onClick, onAtRiskToggle, onMarkComplete }: TaskCardProps) {
  const isOrphan = !task.assignee;
  const isLimbo = task.assignee === 'Limbo';
  const assigneeColor = task.assignee && !isLimbo ? getAssigneeColor(task.assignee) : undefined;

  const cardStyle = assigneeColor
    ? ({ '--assignee-color': assigneeColor } as React.CSSProperties)
    : undefined;

  return (
    <div
      className={[
        styles.card,
        task.atRisk && styles.atRisk,
        task.acknowledged && styles.completed,
        isLimbo ? styles.limbo : isOrphan ? styles.orphan : styles.assigned,
        task.isDraft && styles.draft,
      ].filter(Boolean).join(' ')}
      style={cardStyle}
      onClick={onClick}
    >
      {onAtRiskToggle && (
        <button
          className={`${styles.atRiskToggle} ${task.atRisk ? styles.active : ''}`}
          onClick={e => { e.stopPropagation(); onAtRiskToggle(task.id, !task.atRisk); }}
          title={task.atRisk ? 'Remove at risk flag' : 'Mark as at risk'}
        >
          ⚠
        </button>
      )}

      {onMarkComplete && task.status === 'done' && (
        <button
          className={`${styles.markCompleteBtn} ${task.acknowledged ? styles.active : ''}`}
          onClick={e => { e.stopPropagation(); onMarkComplete(task.id, !task.acknowledged); }}
          title={task.acknowledged ? 'Unmark as completed' : 'Mark as completed (PM approved)'}
        >
          ✓
        </button>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={`${styles.type} ${styles[task.type]}`}>
            {TYPE_ICONS[task.type] || task.type.toUpperCase()}
          </span>
          {task.deployedAt && (
            <span
              className={styles.deployedBadge}
              title={`Deployed ${new Date(task.deployedAt).toLocaleDateString()}`}
            >
              🚀
            </span>
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
        <span className={styles.priority} style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}>
          {task.priority.toUpperCase()}
        </span>
      </div>

      <h4
        className={styles.title}
        style={containsHebrew(task.title) ? { direction: 'rtl', textAlign: 'right' } : undefined}
      >
        {task.title}
      </h4>

      {task.description && <p className={styles.description}>{stripHtml(task.description)}</p>}

      {task.tags.length > 0 && (
        <div className={styles.tags}>
          {task.tags.slice(0, 2).map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
          {task.tags.length > 2 && <span className={styles.tag}>+{task.tags.length - 2}</span>}
        </div>
      )}

      <div className={styles.footer}>
        {(task.assignee || task.opener) && (
          <span className={styles.assignee} style={{ color: assigneeColor }}>
            {task.assignee && `@${task.assignee}`}
            {task.opener && (
              <span className={styles.opener}>
                {task.assignee ? ' ' : ''}By {anon(task.opener)}
              </span>
            )}
          </span>
        )}
        <div className={styles.footerRight}>
          {task.createdAt && <span className={styles.createdAt}>{formatCreatedAt(task.createdAt)}</span>}
          <span className={`${styles.dueDate} ${task.dueDate && isOverdue(task.dueDate) ? styles.overdue : ''}`}>
            {task.dueDate ? formatDueDate(task.dueDate) : 'not urgent'}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Browser-generated ids are not a name worth showing. */
function anon(opener: string): string {
  return opener.startsWith('user_') || opener.startsWith('anon_') ? 'Anon' : opener;
}
