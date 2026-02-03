import { useState } from 'react';
import { linkWhatsApp, unlinkWhatsApp } from '../../../services/adminService';
import type { AdminUser } from '../../../types/admin';
import styles from './LinkWhatsAppModal.module.css';

interface LinkWhatsAppModalProps {
  baseURL: string;
  user: AdminUser;
  onClose: () => void;
  onLinked: (user: AdminUser) => void;
}

export function LinkWhatsAppModal({ baseURL, user, onClose, onLinked }: LinkWhatsAppModalProps) {
  const [phone, setPhone] = useState(user.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLinked = !!user.whatsappConversationId;

  const handleLink = async () => {
    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await linkWhatsApp(user.id, { phone: phone.trim() }, baseURL);
      onLinked({ ...user, ...updated, conversationCount: user.conversationCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link WhatsApp');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await unlinkWhatsApp(user.id, baseURL);
      onLinked({ ...user, ...updated, conversationCount: user.conversationCount });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink WhatsApp');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isLinked ? 'WhatsApp Linked' : 'Link WhatsApp'}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.userInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>User ID:</span>
              <span className={styles.infoValue}>{user.externalId}</span>
            </div>
            {user.name && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Name:</span>
                <span className={styles.infoValue}>{user.name}</span>
              </div>
            )}
          </div>

          {isLinked ? (
            <div className={styles.linkedSection}>
              <div className={styles.linkedInfo}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div>
                  <p className={styles.linkedTitle}>WhatsApp is linked</p>
                  <p className={styles.linkedPhone}>{user.phone}</p>
                </div>
              </div>
              <p className={styles.linkedNote}>
                This user can view their WhatsApp conversation history from the web interface.
              </p>
            </div>
          ) : (
            <div className={styles.field}>
              <label className={styles.label}>WhatsApp Phone Number</label>
              <input
                type="tel"
                className={styles.input}
                placeholder="e.g., 972501234567"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value);
                  setError(null);
                }}
              />
              <span className={styles.hint}>
                International format without + (digits only). If a WhatsApp user exists with this number,
                their conversation will be merged into this user's account.
              </span>
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isSubmitting}
          >
            Close
          </button>
          {isLinked ? (
            <button
              type="button"
              className={styles.unlinkButton}
              onClick={handleUnlink}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Unlinking...' : 'Unlink WhatsApp'}
            </button>
          ) : (
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleLink}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Linking...' : 'Link WhatsApp'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
