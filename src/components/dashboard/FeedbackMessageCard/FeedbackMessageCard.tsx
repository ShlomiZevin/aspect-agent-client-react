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

  // Null for general feedback, which has no reply behind it.
  const messageContent = feedback.messageContent ?? '';
  const truncatedMessage = messageContent.length > 200 && !expanded
    ? messageContent.slice(0, 200) + '...'
    : messageContent;

  // Build conversation URL using agent's URL slug from database
  const conversationUrl = feedback.agentUrlSlug
    ? `/${feedback.agentUrlSlug}/conversations/${feedback.conversationId}`
    : null;

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
          {conversationUrl && (
            <a
              href={conversationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkButton}
              aria-label="View conversation"
              title="View conversation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
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

      {/* General feedback has no conversation behind it, so the transcript
          blocks are skipped entirely rather than rendered empty. */}
      {feedback.source !== 'general' && (
      <div className={styles.userMessage}>
        <span className={styles.roleLabel}>User:</span> {feedback.userMessage}
      </div>
      )}

      {feedback.source !== 'general' && (
      <div className={styles.assistantMessage}>
        <span className={styles.roleLabel}>Assistant:</span>{' '}
        {truncatedMessage}
        {(feedback.messageContent?.length ?? 0) > 200 && (
          <button
            className={styles.expandButton}
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
      )}

      <div className={styles.feedbackSection}>
        <div className={styles.feedbackLabel}>
          {feedback.source === 'general' ? 'Feedback (sent from the app)' : 'Feedback'}
        </div>
        {/* Rows written since screenshots were allowed contain HTML; older rows
            are plain text and must keep rendering as text, or their content
            shows up mangled. The HTML was sanitised server-side on write (see
            services/sanitize-feedback-html.js) — this is not the trust
            boundary, and nothing unsanitised should ever reach here. */}
        {feedback.isHtml ? (
          <div
            className={`${styles.feedbackText} ${styles.feedbackRich}`}
            dangerouslySetInnerHTML={{ __html: feedback.feedbackText }}
          />
        ) : (
          <div className={styles.feedbackText}>{feedback.feedbackText}</div>
        )}
        {(feedback.contact || feedback.contextUrl) && (
          <div className={styles.feedbackMeta}>
            {feedback.contact && <span>{feedback.contact}</span>}
            {feedback.contextUrl && (
              <a href={feedback.contextUrl} target="_blank" rel="noopener noreferrer">
                {feedback.contextUrl}
              </a>
            )}
          </div>
        )}
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
