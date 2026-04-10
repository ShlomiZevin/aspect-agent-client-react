import { useState, useEffect, useRef } from 'react';
import type { TaskComment, Assignee } from '../../../types/task';
import * as commentsService from '../../../services/commentsService';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import styles from './CommentsSection.module.css';

/** Highlight @Name mentions inside comment HTML */
function highlightMentions(html: string): string {
  return html.replace(/@([\w\u00C0-\uFFFF]+)/g, '<span class="mention">@$1</span>');
}

interface CommentsSectionProps {
  taskId: number;
  assignees: Assignee[];
  refreshTrigger?: number;
  hideHeader?: boolean;
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

function isMostlyHebrew(html: string): boolean {
  const text = html.replace(/<[^>]*>/g, '');
  const hebrew = text.match(/[\u0590-\u05FF]/g)?.length || 0;
  const latin = text.match(/[a-zA-Z]/g)?.length || 0;
  return hebrew > latin;
}

function isHtmlEmpty(html: string): boolean {
  if (!html || html === '<br>') return true;
  const div = document.createElement('div');
  div.innerHTML = html;
  return !div.textContent?.trim() && !div.querySelector('img');
}

export function CommentsSection({ taskId, assignees, refreshTrigger, hideHeader }: CommentsSectionProps) {
  const { identity, setIdentity } = useCommenterIdentity();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [showIdentityPicker, setShowIdentityPicker] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleCommentContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      setLightboxImage((target as HTMLImageElement).src);
    }
  };

  const handleLike = async (commentId: number) => {
    if (!identity) return;
    try {
      const updated = await commentsService.toggleLike(commentId, identity);
      setComments(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  // Load (or reload) comments when task opens or refreshTrigger increments
  useEffect(() => {
    // Show spinner only when switching to a different task (no existing comments)
    // Refreshes (refreshTrigger) update silently to avoid jumping
    setLoading(prev => prev || comments.length === 0);
    commentsService.getComments(taskId)
      .then(data => {
        setComments(data);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, refreshTrigger]);

  const handleSubmit = async () => {
    if (isHtmlEmpty(text)) return;

    // If no identity yet, show picker first
    if (!identity) {
      setShowIdentityPicker(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const comment = await commentsService.addComment(taskId, identity, text.trim());
      setComments(prev => [...prev, comment]);
      setText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) {
      console.error('Failed to add comment:', err);
      const msg = err instanceof Error ? err.message : 'Failed to post comment';
      setSubmitError(msg.includes('large') || msg.includes('413') ? 'Comment is too large (image too big). Try a smaller screenshot.' : 'Failed to post comment. Please try again.');
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
    if (!isHtmlEmpty(text)) {
      setSubmitting(true);
      commentsService.addComment(taskId, name, text.trim())
        .then(comment => {
          setComments(prev => [...prev, comment]);
          setText('');
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        })
        .catch((err) => {
          console.error('Failed to add comment:', err);
          const msg = err instanceof Error ? err.message : '';
          setSubmitError(msg.includes('large') || msg.includes('413') ? 'Comment is too large (image too big). Try a smaller screenshot.' : 'Failed to post comment. Please try again.');
        })
        .finally(() => setSubmitting(false));
    }
  };

  return (
    <div className={styles.section}>
      {!hideHeader && (
        <div className={styles.header}>
          <span className={styles.title}>
            Comments {comments.length > 0 && <span className={styles.count}>({comments.length})</span>}
          </span>
          {identity && (
            <div className={styles.identity}>
              <span>Commenting as <strong>{identity}</strong></span>
              <button className={styles.changeIdentityBtn} onClick={() => setShowIdentityPicker(true)}>
                Not {identity}?
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* Comment list — scrollable, grows to fill space */}
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
              <div
                className={styles.commentContent}
                dir={isMostlyHebrew(c.content) ? 'rtl' : 'ltr'}
                dangerouslySetInnerHTML={{ __html: highlightMentions(c.content) }}
                onClick={handleCommentContentClick}
              />
            </div>
            {identity && (
              <button
                className={`${styles.likeBtn} ${c.likedBy?.includes(identity) ? styles.liked : ''}`}
                onClick={() => handleLike(c.id)}
                title={c.likedBy?.length ? `Liked by ${c.likedBy.join(', ')}` : 'Like'}
              >
                {c.likedBy?.includes(identity) ? '❤️' : '🤍'}
                {c.likedBy && c.likedBy.length > 0 && <span className={styles.likeCount}>{c.likedBy.length}</span>}
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area — sticky at bottom */}
      {!showIdentityPicker && (
        <div className={styles.inputArea}>
          {/* Ctrl+Enter submit via keydown bubbling */}
          <div
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          >
            <RichTextEditor
              value={text}
              onChange={setText}
              placeholder={identity ? 'Add a comment… (Ctrl+Enter to submit)' : 'Add a comment…'}
              assignees={assignees}
            />
          </div>
          {submitError && (
            <div className={styles.submitError}>{submitError}</div>
          )}
          <div className={styles.inputActions}>
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={submitting || isHtmlEmpty(text)}
            >
              {submitting ? 'Posting…' : 'Comment'}
            </button>
          </div>
        </div>
      )}
      {lightboxImage && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxImage(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxImage(null)}>×</button>
          <img src={lightboxImage} alt="Screenshot" className={styles.lightboxImage} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
