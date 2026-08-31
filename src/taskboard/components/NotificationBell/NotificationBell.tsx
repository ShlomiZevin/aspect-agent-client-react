import { useEffect, useRef, useState } from 'react';
import type { Notification } from '../../types';
import styles from './NotificationBell.module.css';

/**
 * Unread notifications, and a way into the task each one is about.
 *
 * Clicking one opens its task and marks just that notification read — not all
 * of them. The old bell cleared everything on open, which meant glancing at it
 * silently threw away the rest.
 */
interface Props {
  items: Notification[];
  onOpenTask: (taskId: number) => void;
  onMarkRead: (ids?: number[]) => void;
}

export function NotificationBell({ items, onOpenTask, onMarkRead }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Registered only while open, so the
  // board is not paying for two global listeners the rest of the time.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={wrap}>
      <button
        type="button"
        className={`${styles.bell} ${open ? styles.bellActive : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={items.length ? `${items.length} unread notifications` : 'Notifications'}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {items.length > 0 && <span className={styles.badge}>{items.length > 99 ? '99+' : items.length}</span>}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Notifications</span>
            {items.length > 0 && (
              <button type="button" className={styles.clear} onClick={() => onMarkRead()}>
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0
            ? <p className={styles.empty}>Nothing waiting on you.</p>
            : items.map(n => (
              <button
                key={n.id}
                type="button"
                className={styles.item}
                onClick={() => {
                  onOpenTask(n.taskId);
                  onMarkRead([n.id]);
                  setOpen(false);
                }}
              >
                <span className={styles.itemTitle}>#{n.taskId} {n.taskTitle}</span>
                <span className={styles.itemMeta}>
                  {label(n.type)} · {new Date(n.createdAt).toLocaleString()}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/** The server stores types like `assigned_by:Noa`; only the verb is shown. */
function label(type: string): string {
  const [kind, who] = type.split(':');
  switch (kind) {
    case 'comment':  return who ? `${who} commented` : 'New comment';
    case 'mention':  return who ? `${who} mentioned you` : 'You were mentioned';
    case 'assigned': return who ? `${who} assigned it to you` : 'Assigned to you';
    case 'deployed': return 'Deployed';
    default:         return kind.replace(/_/g, ' ');
  }
}
