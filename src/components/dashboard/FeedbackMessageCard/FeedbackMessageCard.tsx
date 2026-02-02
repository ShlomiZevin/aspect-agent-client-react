import { useState } from 'react';
import styles from './FeedbackMessageCard.module.css';
import type { FeedbackMessage } from '../../../types/feedback';

interface FeedbackMessageCardProps {
  feedback: FeedbackMessage;
}

export function FeedbackMessageCard({ feedback }: FeedbackMessageCardProps) {
  const [expanded, setExpanded] = useState(false);

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
        <span className={styles.date}>
          {feedback.createdAt.toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
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
