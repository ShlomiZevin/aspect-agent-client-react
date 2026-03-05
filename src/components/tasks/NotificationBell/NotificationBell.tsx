import { useState, useRef, useEffect } from 'react';
import type { UseNotificationsReturn } from '../../../hooks/useNotifications';
import styles from './NotificationBell.module.css';

interface NotificationBellProps {
  notifications: UseNotificationsReturn;
  onOpenTask: (taskId: number) => void;
}

function formatText(type: string, taskId: number): string {
  if (type === 'mention') return `Someone mentioned you in task #${taskId}`;
  if (type === 'assigned') return `You were assigned to task #${taskId}`;
  if (type === 'status_changed') return `Task #${taskId} was moved to a new status`;
  return `Someone commented on your task #${taskId}`;
}

function dotClass(type: string): string {
  if (type === 'mention') return 'dotMention';
  if (type === 'assigned') return 'dotAssigned';
  if (type === 'status_changed') return 'dotStatus';
  return 'dotComment';
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function NotificationBell({ notifications, onOpenTask }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications: items, unreadCount, markRead, markAllRead, identity } = notifications;

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleNotificationClick = async (id: number, taskId: number) => {
    await markRead(id);
    setOpen(false);
    onOpenTask(taskId);
  };

  if (!identity) return null;

  return (
    <div className={styles.container} ref={panelRef}>
      <button
        className={styles.bell}
        onClick={() => setOpen(o => !o)}
        title="Notifications"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={() => { markAllRead(); }}>
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className={styles.empty}>No new notifications</div>
          ) : (
            <div className={styles.list}>
              {items.map(n => (
                <button
                  key={n.id}
                  className={styles.item}
                  onClick={() => handleNotificationClick(n.id, n.taskId)}
                >
                  <span className={`${styles.dot} ${styles[dotClass(n.type)]}`} />
                  <div className={styles.itemBody}>
                    <span className={styles.itemText}>
                      {formatText(n.type, n.taskId)}
                    </span>
                    <span className={styles.itemTime}>{formatTime(n.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
