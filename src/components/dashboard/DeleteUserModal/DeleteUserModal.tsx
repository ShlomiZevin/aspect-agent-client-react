import { useState } from 'react';
import { deleteUser } from '../../../services/adminService';
import type { AdminUser } from '../../../types/admin';
import styles from './DeleteUserModal.module.css';

interface DeleteUserModalProps {
  baseURL: string;
  user: AdminUser;
  onClose: () => void;
  onDeleted: (userId: number) => void;
}

export function DeleteUserModal({ baseURL, user, onClose, onDeleted }: DeleteUserModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await deleteUser(user.id, baseURL);
      onDeleted(user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Delete User</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={isDeleting}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.warningIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <div className={styles.userInfo}>
            <p className={styles.userName}>
              {user.name || user.phone || user.email || user.externalId}
            </p>
            <p className={styles.userDetails}>
              {user.source} user • {user.conversationCount} conversation{user.conversationCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className={styles.warningBox}>
            <p className={styles.warningTitle}>This action is irreversible!</p>
            <p className={styles.warningText}>
              Deleting this user will permanently remove:
            </p>
            <ul className={styles.warningList}>
              <li>The user account and all profile information</li>
              <li>All {user.conversationCount} conversation{user.conversationCount !== 1 ? 's' : ''} associated with this user</li>
              <li>All messages within those conversations</li>
            </ul>
            <p className={styles.warningText}>
              This data cannot be recovered after deletion.
            </p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
