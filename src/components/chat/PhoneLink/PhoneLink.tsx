import { useState, useCallback, useEffect } from 'react';
import { useChatContext } from '../../../context';
import styles from './PhoneLink.module.css';

type PhoneAction = 'goMobile' | 'fetchHistory' | null;

const MODAL_CONFIG = {
  goMobile: {
    title: 'Go Mobile',
    description: 'Enter a WhatsApp phone number to link this conversation. Future messages will be associated with that number. Use the full number with country code (e.g. 972501234567).',
    submitLabel: 'Link',
    successMessage: 'Linked! Conversation is now mobile.',
  },
  fetchHistory: {
    title: 'Fetch History',
    description: 'Enter a WhatsApp phone number to load its conversation history. Use the full number with country code (e.g. 972501234567).',
    submitLabel: 'Fetch',
    successMessage: 'Connected! Loading history...',
  },
} as const;

export function PhoneLink() {
  const { linkedPhone, linkPhone, goMobile } = useChatContext();
  const [activeAction, setActiveAction] = useState<PhoneAction>(null);
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleOpen = useCallback((action: PhoneAction) => {
    setActiveAction(action);
    setError(null);
    setSuccess(false);
    setPhone('');
  }, []);

  const handleClose = useCallback(() => {
    setActiveAction(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!phone.trim() || !activeAction) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (activeAction === 'goMobile') {
        await goMobile(phone.trim());
      } else {
        await linkPhone(phone.trim());
      }
      setSuccess(true);
      setTimeout(() => setActiveAction(null), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('phone_has_history')) {
        setError('This phone number already has conversation history. Use "Fetch History" instead.');
      } else if (message.includes('phone_not_found') || message.includes('404')) {
        setError('Phone number not found. Make sure you have chatted via WhatsApp first.');
      } else if (message.includes('No active conversation')) {
        setError('No active conversation. Send a message first.');
      } else {
        setError('Failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, activeAction, goMobile, linkPhone]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!activeAction) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'Enter' && !isSubmitting) handleSubmit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAction, handleClose, handleSubmit, isSubmitting]);

  const config = activeAction ? MODAL_CONFIG[activeAction] : null;

  return (
    <>
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.button} ${linkedPhone ? styles.buttonLinked : ''}`}
          onClick={() => handleOpen('goMobile')}
          title={linkedPhone ? `Linked: ${linkedPhone}` : 'Link this conversation to a phone number'}
        >
          <span className={styles.buttonEmoji}>📱</span>
          <span>{linkedPhone ? linkedPhone : 'Go Mobile'}</span>
        </button>

        <button
          className={styles.button}
          onClick={() => handleOpen('fetchHistory')}
          title="Fetch phone conversation history"
        >
          <span className={styles.buttonEmoji}>🔍</span>
          <span>Fetch History</span>
        </button>
      </div>

      {activeAction && config && (
        <div className={styles.backdrop} onClick={handleClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h3 className={styles.title}>{config.title}</h3>
              <button className={styles.closeButton} onClick={handleClose}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className={styles.body}>
              <p className={styles.description}>{config.description}</p>
              <div className={styles.inputGroup}>
                <input
                  className={styles.input}
                  type="tel"
                  placeholder="972501234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
                <button
                  className={styles.submitButton}
                  onClick={handleSubmit}
                  disabled={isSubmitting || !phone.trim()}
                >
                  {isSubmitting ? '...' : config.submitLabel}
                </button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
              {success && <p className={styles.success}>{config.successMessage}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
