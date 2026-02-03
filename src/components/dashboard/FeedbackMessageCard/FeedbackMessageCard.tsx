import { useState } from 'react';
import styles from './FeedbackMessageCard.module.css';
import type { FeedbackMessage } from '../../../types/feedback';

interface FeedbackMessageCardProps {
  feedback: FeedbackMessage;
  onDelete?: (feedbackId: string) => void;
}

export function FeedbackMessageCard({ feedback, onDelete }: FeedbackMessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    await onDelete(feedback.id);
    setIsDeleting(false);
  };

  const truncatedMessage = feedback.messageContent.length > 200 && !expanded
    ? feedback.messageContent.slice(0, 200) + '...'
    : feedback.messageContent;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.meta}>
          {feedback.crewMember && (
            <span className={styles.crewBadge}>{feedback.crewMember}</span>
          )}
        </div>
        <div className={styles.headerRight}>
          <span className={styles.date}>
            {feedback.createdAt.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          {onDelete && (
            <button
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isDeleting}
              type="button"
              aria-label="Delete feedback"
            >
              {isDeleting ? '...' : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div className={styles.userMessage}>
        <span className={styles.roleLabel}>User:</span> {feedback.userMessage}
      </div>

      <div className={styles.assistantMessage}>
        <span className={styles.roleLabel}>Assistant:</span>{' '}
        {truncatedMessage}
        {feedback.messageContent.length > 200 && (
          <button
            className={styles.expandButton}
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      <div className={styles.feedbackSection}>
        <div className={styles.feedbackLabel}>Feedback</div>
        <div className={styles.feedbackText}>{feedback.feedbackText}</div>
      </div>

      {feedback.tags.length > 0 && (
        <div className={styles.tags}>
          {feedback.tags.map(tag => (
            <span
              key={tag.name}
              className={styles.tag}
              style={{ '--tag-color': tag.color, '--tag-bg': `${tag.color}15` } as React.CSSProperties}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
