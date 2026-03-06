import { useState, useEffect, useRef } from 'react';
import type { TaskComment, Assignee } from '../../../types/task';
import * as commentsService from '../../../services/commentsService';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import styles from './CommentsSection.module.css';

/** Highlight @Name mentions inside comment HTML */
function highlightMentions(html: string): string {
  return html.replace(/@([\w\u0080-\uFFFF]+)/g, '<span class="mention">@$1</span>');
}

interface CommentsSectionProps {
  taskId: number;
  assignees: Assignee[];
  refreshTrigger?: number;
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

function isHtmlEmpty(html: string): boolean {
  if (!html || html === '<br>') return true;
  const div = document.createElement('div');
  div.innerHTML = html;
  return !div.textContent?.trim() && !div.querySelector('img');
}

export function CommentsSection({ taskId, assignees, refreshTrigger }: CommentsSectionProps) {
  const { identity, setIdentity } = useCommenterIdentity();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [showIdentityPicker, setShowIdentityPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

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

  // Close mention picker when clicking outside
  useEffect(() => {
    if (!showMentionPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target as Node)) {
        setShowMentionPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMentionPicker]);

  const insertMention = (name: string) => {
    setShowMentionPicker(false);
    const editorEl = editorRef.current?.querySelector('[contenteditable]') as HTMLElement | null;
    if (editorEl) {
      editorEl.focus();
      const sel = window.getSelection();
      if (sel) {
        // Restore the saved cursor position, or collapse to end as fallback
        const range = savedRangeRef.current ?? (() => {
          const r = document.createRange();
          r.selectNodeContents(editorEl);
          r.collapse(false);
          return r;
        })();
        sel.removeAllRanges();
        sel.addRange(range);
        range.deleteContents();
        range.insertNode(document.createTextNode(`@${name} `));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      savedRangeRef.current = null;
      const event = new Event('input', { bubbles: true });
      editorEl.dispatchEvent(event);
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
                dangerouslySetInnerHTML={{ __html: highlightMentions(c.content) }}
              />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area — sticky at bottom */}
      {!showIdentityPicker && (
        <div className={styles.inputArea}>
          {/* Ctrl+Enter submit via keydown bubbling */}
          <div
            ref={editorRef}
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
            />
          </div>
          {submitError && (
            <div className={styles.submitError}>{submitError}</div>
          )}
          <div className={styles.inputActions}>
            {/* @ Mention picker */}
            <div className={styles.mentionPickerWrapper} ref={mentionDropdownRef}>
              <button
                type="button"
                className={styles.mentionBtn}
                onClick={() => {
                  // Save cursor position before the editor loses focus
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0) {
                    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                  }
                  setShowMentionPicker(o => !o);
                }}
                title="Mention someone"
              >
                @ Mention
              </button>
              {showMentionPicker && assignees.length > 0 && (
                <div className={styles.mentionDropdown}>
                  {assignees.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.mentionOption}
                      onClick={() => insertMention(a.name)}
                    >
                      <span className={styles.mentionAvatar} style={{ background: authorColor(a.name) }}>
                        {a.name[0].toUpperCase()}
                      </span>
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
    </div>
  );
}
