import { useMemo, useState } from 'react';
import type { Task } from '../../types';
import styles from './ListView.module.css';

/**
 * The board as a sortable table.
 *
 * Kanban is for moving work along; the list is for reading a lot of it at once
 * and for answering "what is overdue" or "what is unassigned", which columns of
 * cards are bad at.
 */
type Column = 'id' | 'title' | 'status' | 'priority' | 'type' | 'assignee' | 'dueDate';

const COLUMNS: { key: Column; label: string }[] = [
  { key: 'id', label: '#' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'type', label: 'Type' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'dueDate', label: 'Due' },
];

// Sorting by priority alphabetically puts critical after high, which is worse
// than not sorting at all.
const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_RANK: Record<string, number> = { in_progress: 0, todo: 1, done: 2 };

interface Props {
  tasks: Task[];
  attentionIds: Set<number> | null;
  onOpen: (task: Task) => void;
}

export function ListView({ tasks, attentionIds, onOpen }: Props) {
  const [sort, setSort] = useState<{ by: Column; desc: boolean }>({ by: 'id', desc: true });

  const rows = useMemo(() => {
    const value = (t: Task): string | number => {
      switch (sort.by) {
        case 'priority': return PRIORITY_RANK[t.priority] ?? 9;
        case 'status':   return STATUS_RANK[t.status] ?? 9;
        // Undated sorts last in either direction rather than jumping to the top
        // as an empty string would.
        case 'dueDate':  return t.dueDate ?? '9999-12-31';
        case 'assignee': return (t.assignee ?? '￿').toLowerCase();
        case 'title':    return t.title.toLowerCase();
        default:         return t.id;
      }
    };
    return [...tasks].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : a.id - b.id;
      return sort.desc ? -cmp : cmp;
    });
  }, [tasks, sort]);

  const toggle = (by: Column) =>
    setSort(s => (s.by === by ? { by, desc: !s.desc } : { by, desc: by === 'id' }));

  if (rows.length === 0) return <div className={styles.wrap}><p className={styles.empty}>Nothing to show.</p></div>;

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMNS.map(c => (
              <th
                key={c.key}
                className={`${styles.th} ${styles.sortable}`}
                onClick={() => toggle(c.key)}
                aria-sort={sort.by === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}
              >
                {c.label}
                {sort.by === c.key && <span className={styles.arrow}>{sort.desc ? '▼' : '▲'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id} className={styles.row} onClick={() => onOpen(t)}>
              <td className={`${styles.td} ${styles.id}`}>{t.id}</td>
              <td className={`${styles.td} ${styles.title}`}>
                {t.title}
                {attentionIds?.has(t.id) && <span className={`${styles.chip} ${styles.progress}`} style={{ marginInlineStart: 8 }}>waiting on you</span>}
                {t.atRisk && <span className={`${styles.chip} ${styles.critical}`} style={{ marginInlineStart: 8 }}>at risk</span>}
              </td>
              <td className={styles.td}>
                <span className={[styles.chip, t.status === 'done' && styles.done, t.status === 'in_progress' && styles.progress].filter(Boolean).join(' ')}>
                  {t.status.replace('_', ' ')}
                </span>
              </td>
              <td className={styles.td}>
                <span className={[styles.chip, styles[t.priority]].filter(Boolean).join(' ')}>{t.priority}</span>
              </td>
              <td className={`${styles.td} ${styles.muted}`}>{t.type}</td>
              <td className={`${styles.td} ${styles.muted}`}>{t.assignee ?? '—'}</td>
              <td className={`${styles.td} ${styles.muted} ${overdue(t) ? styles.atRisk : ''}`}>
                {t.dueDate ? t.dueDate.slice(0, 10) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Past its date and not finished. Compared as ISO strings — both are dates. */
function overdue(t: Task): boolean {
  if (!t.dueDate || t.status === 'done') return false;
  return t.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10);
}
