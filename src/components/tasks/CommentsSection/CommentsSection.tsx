import { useState, useEffect, useRef } from 'react';
import type { TaskComment, Assignee } from '../../../types/task';
import * as commentsService from '../../../services/commentsService';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import styles from './CommentsSection.module.css';

interface CommentsSectionProps {
  taskId: number;
  assignees: Assignee[];
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay}d ago`;
}

// Generate a stable color from a name string
function authorColor(name: string): string {
  const colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function CommentsSection({ taskId, assignees }: CommentsSectionProps) {
  const { identity, setIdentity } = useCommenterIdentity();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const [showIdentityPicker, setShowIdentityPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load comments when task opens
  useEffect(() => {
    setLoading(true);
    commentsService.getComments(taskId)
      .then(setComments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleSubmit = async () => {
    if (!text.trim()) return;

    // If no identity yet, show picker first
    if (!identity) {
      setShowIdentityPicker(true);
      return;
    }

    setSubmitting(true);
    try {
      const comment = await commentsService.addComment(taskId, identity, text.trim());
      setComments(prev => [...prev, comment]);
      setText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await commentsService.deleteComment(taskId, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const handleIdentitySelect = (name: string) => {
    setIdentity(name);
    setShowIdentityPicker(false);
    // If there was pending text, submit it now
    if (text.trim()) {
      setSubmitting(true);
      commentsService.addComment(taskId, name, text.trim())
        .then(comment => {
          setComments(prev => [...prev, comment]);
          setText('');
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
        .catch(console.error)
        .finally(() => setSubmitting(false));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>Comments {comments.length > 0 && <span className={styles.count}>({comments.length})</span>}</span>
        {identity && (
          <span className={styles.identity}>
            Commenting as <strong>{identity}</strong>
            <button className={styles.changeIdentityBtn} onClick={() => setShowIdentityPicker(true)}>
              Not {identity}?
            </button>
          </span>
        )}
      </div>

      {/* Identity picker overlay */}
      {showIdentityPicker && (
        <div className={styles.identityPicker}>
          <p className={styles.identityPrompt}>Who are you?</p>
          <div className={styles.identityList}>
            {assignees.map(a => (
              <button
                key={a.id}
                className={styles.identityOption}
                onClick={() => handleIdentitySelect(a.name)}
              >
                <span className={styles.identityAvatar} style={{ background: authorColor(a.name) }}>
                  {a.name[0].toUpperCase()}
                </span>
                {a.name}
              </button>
            ))}
          </div>
          {identity && (
            <button className={styles.cancelIdentityBtn} onClick={() => setShowIdentityPicker(false)}>
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Comment list */}
      <div className={styles.list}>
        {loading && <div className={styles.empty}>Loading…</div>}
        {!loading && comments.length === 0 && (
          <div className={styles.empty}>No comments yet.</div>
        )}
        {comments.map(c => (
          <div key={c.id} className={styles.comment}>
            <span className={styles.avatar} style={{ background: authorColor(c.author) }}>
              {c.author[0].toUpperCase()}
            </span>
            <div className={styles.commentBody}>
              <div className={styles.commentMeta}>
                <strong className={styles.commentAuthor}>{c.author}</strong>
                <span className={styles.commentTime} title={new Date(c.createdAt).toLocaleString()}>
                  {formatRelativeTime(c.createdAt)}
                </span>
                {identity === c.author && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(c.id)}
                    title="Delete comment"
                  >
                    ×
                  </button>
                )}
              </div>
              <p className={styles.commentContent}>{c.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!showIdentityPicker && (
        <div className={styles.inputArea}>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={identity ? 'Add a comment… (Ctrl+Enter to submit)' : 'Add a comment…'}
            rows={2}
            disabled={submitting}
          />
          <div className={styles.inputActions}>
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={submitting || !text.trim()}
            >
              {submitting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
