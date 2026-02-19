import { useState } from 'react';
import type { DemoMessage, Language } from '../../../types/demo';
import { parseConversation } from '../../../services/demoService';
import styles from './ParseModal.module.css';

interface ParseModalProps {
  language: Language;
  onParsed: (messages: DemoMessage[]) => void;
  onClose: () => void;
}

export function ParseModal({ language, onParsed, onClose }: ParseModalProps) {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const messages = await parseConversation(text, language);
      onParsed(messages);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse conversation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} onKeyDown={handleKeyDown}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Paste & Parse Conversation</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.description}>
            Paste a conversation in free text format. Our AI will automatically
            detect speakers and convert it into structured messages.
          </p>

          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste your conversation here...

Format:
Speaker: message text

Date markers (optional):
[Monday] [Jan 15] [Yesterday] [2 days ago 14:00]`}
            autoFocus
          />

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.example}>
            <div className={styles.exampleTitle}>Example format</div>
            <div className={styles.exampleText}>
              {language === 'he'
                ? `[יום שני]
לקוח: שלום, אני צריך עזרה
נציג: היי! איך אפשר לעזור לך?
[יום שלישי 14:00]
לקוח: יש לי שאלה לגבי החשבון`
                : `[Monday]
Customer: Hello, I need help
Agent: Hi! How can I assist you?
[Tuesday 14:00]
Customer: Following up on my request`}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={handleParse}
            disabled={!text.trim() || isLoading}
          >
            {isLoading ? (
              <span className={styles.loading}>
                <span className={styles.spinner} />
                Parsing...
              </span>
            ) : (
              'Parse Conversation'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
