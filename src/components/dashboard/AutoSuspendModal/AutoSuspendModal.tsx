import { useState } from 'react';
import { clearUserAutoSuspend } from '../../../services/adminService';
import type { AdminUser } from '../../../types/admin';
import styles from './AutoSuspendModal.module.css';

interface AutoSuspendModalProps {
  baseURL: string;
  user: AdminUser;
  /** When the user is suspended by itself (ISO) — the limit picked in Add user (#1002). */
  autoSuspendAt: string;
  onClose: () => void;
  onCleared: (user: AdminUser) => void;
}

/** A user's auto-suspend (#1002): when it happens, and Turn off. */
export function AutoSuspendModal({ baseURL, user, autoSuspendAt, onClose, onCleared }: AutoSuspendModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const when = new Date(autoSuspendAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const turnOff = async () => {
    setIsSaving(true);
    setError(null);
    try {
      onCleared(await clearUserAutoSuspend(user.id, baseURL));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to turn auto-suspend off');
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Auto-suspend</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={isSaving} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.userName}>{user.name || user.phone || user.externalId}</p>
          <p className={styles.when} title="Then they can't chat; nothing is deleted">
            Suspends automatically on <b>{when}</b>
          </p>
          {/* Reserved line: an error never resizes the modal. */}
          <div className={styles.error} role="alert">{error || ' '}</div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose} disabled={isSaving}>
              Close
            </button>
            <button type="button" className={styles.submitButton} onClick={turnOff} disabled={isSaving}>
              {isSaving ? 'Turning off...' : 'Turn off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
