import { useState, useRef, useEffect } from 'react';
import type { UseNotificationsReturn } from '../../../hooks/useNotifications';
import type { Assignee } from '../../../types/task';
import styles from './NotificationBell.module.css';

interface NotificationBellProps {
  notifications: UseNotificationsReturn;
  assignees: Assignee[];
  onOpenTask: (taskId: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
};

function formatText(type: string, taskId: number): string {
  if (type === 'mention') return `Someone mentioned you in task #${taskId}`;
  if (type.startsWith('assigned_by:')) {
    const by = type.slice('assigned_by:'.length);
    return `User ${by} assigned you task #${taskId}`;
  }
  if (type === 'assigned') return `You were assigned to task #${taskId}`; // legacy
  if (type.startsWith('moved_to_')) {
    const status = type.slice('moved_to_'.length);
    const label = STATUS_LABELS[status] || status;
    return `Task #${taskId} was moved to ${label}`;
  }
  if (type === 'status_changed') return `Task #${taskId} was moved to a new status`; // legacy
  return `Someone commented on your task #${taskId}`;
}

function dotClass(type: string): string {
  if (type === 'mention') return 'dotMention';
  if (type === 'assigned' || type.startsWith('assigned_by:')) return 'dotAssigned';
  if (type.startsWith('moved_to_') || type === 'status_changed') return 'dotStatus';
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

function avatarColor(name: string): string {
  const colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function NotificationBell({ notifications, assignees, onOpenTask }: NotificationBellProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [identityPickerOpen, setIdentityPickerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { notifications: items, newCount, identity, setIdentity, clearNew } = notifications;

  // Close everything when clicking outside
  useEffect(() => {
    if (!panelOpen && !identityPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
        setIdentityPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [panelOpen, identityPickerOpen]);

  const handleBellClick = () => {
    const next = !panelOpen;
    setPanelOpen(next);
    setIdentityPickerOpen(false);
    if (next) clearNew(); // clears badge for this browser via localStorage timestamp
  };

  const handleSelectIdentity = (name: string) => {
    setIdentity(name);
    setIdentityPickerOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>

      {/* Identity chip */}
      {identity ? (
        <button
          className={styles.identityChip}
          onClick={() => { setIdentityPickerOpen(o => !o); setPanelOpen(false); }}
          title="Change who you are"
        >
          <span className={styles.identityAvatar} style={{ background: avatarColor(identity) }}>
            {identity[0].toUpperCase()}
          </span>
          <span className={styles.identityName}>{identity}</span>
        </button>
      ) : (
        <button
          className={styles.identityChipEmpty}
          onClick={() => { setIdentityPickerOpen(o => !o); setPanelOpen(false); }}
          title="Set who you are to receive notifications"
        >
          Who are you?
        </button>
      )}

      {/* Bell button */}
      <button
        className={styles.bell}
        onClick={handleBellClick}
        title={identity ? 'Notifications' : 'Set your name to receive notifications'}
        disabled={!identity}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {newCount > 0 && (
          <span className={styles.badge}>{newCount > 9 ? '9+' : newCount}</span>
        )}
      </button>

      {/* Identity picker dropdown */}
      {identityPickerOpen && (
        <div className={styles.identityDropdown}>
          <p className={styles.identityDropdownTitle}>Who are you?</p>
          <div className={styles.identityList}>
            {assignees.map(a => (
              <button
                key={a.id}
                className={`${styles.identityOption} ${identity === a.name ? styles.identityOptionActive : ''}`}
                onClick={() => handleSelectIdentity(a.name)}
              >
                <span className={styles.identityAvatar} style={{ background: avatarColor(a.name) }}>
                  {a.name[0].toUpperCase()}
                </span>
                {a.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notifications panel */}
      {panelOpen && identity && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
          </div>

          {items.length === 0 ? (
            <div className={styles.empty}>No notifications</div>
          ) : (
            <div className={styles.list}>
              {items.map(n => {
                const isNew = !n.isDelivered;
                return (
                  <button
                    key={n.id}
                    className={`${styles.item} ${isNew ? styles.itemNew : ''}`}
                    onClick={() => { setPanelOpen(false); onOpenTask(n.taskId); }}
                  >
                    <span className={`${styles.dot} ${styles[dotClass(n.type)]}`} />
                    <div className={styles.itemBody}>
                      <span className={styles.itemText}>{formatText(n.type, n.taskId)}</span>
                      <span className={styles.itemTime}>{formatTime(n.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
