import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { RichTextEditor, sanitize } from '../RichTextEditor';
import { useTranslation } from '../../state/useTranslation';
import type { Comment, Person } from '../../types';
import styles from './CommentThread.module.css';

/**
 * A task's conversation, as the original renders it: avatars, relative times,
 * a heart to like, and the same rich editor the description uses, submitting on
 * Ctrl+Enter.
 *
 * Bodies are HTML, as they are there, so the editor's formatting and pasted
 * screenshots survive. The difference is on the way out — everything goes
 * through sanitize() before it is rendered, rather than straight into
 * dangerouslySetInnerHTML.
 */
interface Props {
  taskId: number;
  me: string | null;
  people: Person[];
  onChangeIdentity: () => void;
}

/** @Name, so a mention is visible in a wall of text. */
function highlightMentions(html: string): string {
  return html.replace(/@([\wÀ-￿]+)/g, '<span class="mention">@$1</span>');
}

function formatRelativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay}d ago`;
}

const AUTHOR_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

function authorColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

/** Right-to-left when the text is mostly Hebrew, not merely when it contains it. */
function isMostlyHebrew(html: string): boolean {
  const text = html.replace(/<[^>]*>/g, '');
  const hebrew = (text.match(/[֐-׿]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return hebrew > latin;
}

export function CommentThread({ taskId, me, people, onChangeIdentity }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.listComments(taskId)
      .then(list => { if (!cancelled) setComments(list); })
      .catch(() => { if (!cancelled) setComments([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const post = async () => {
    if (!text.trim() || !me || busy) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await api.addComment(taskId, me, text);
      setComments(c => [...c, comment]);
      setText('');
      // Scrolled after the row exists, so the new comment is what you see.
      window.setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const like = async (comment: Comment) => {
    if (!me) return;
    try {
      const updated = await api.toggleLike(comment.id, me);
      setComments(cs => cs.map(c => (c.id === updated.id ? updated : c)));
    } catch { /* a failed like is not worth interrupting anyone */ }
  };

  const remove = async (id: number) => {
    setComments(cs => cs.filter(c => c.id !== id));
    await api.deleteComment(id).catch(() => {
      void api.listComments(taskId).then(setComments);
    });
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>
          Comments {comments.length > 0 && <span className={styles.count}>({comments.length})</span>}
        </span>
        {me && (
          <div className={styles.identity}>
            <span>Commenting as <strong>{me}</strong></span>
            <button className={styles.changeIdentityBtn} onClick={onChangeIdentity}>Not {me}?</button>
          </div>
        )}
      </div>

      <div className={styles.list}>
        {loading && <div className={styles.empty}>Loading…</div>}
        {!loading && comments.length === 0 && <div className={styles.empty}>No comments yet.</div>}

        {comments.map(c => (
          <CommentRow
            key={c.id}
            comment={c}
            me={me}
            onLike={() => like(c)}
            onDelete={() => remove(c.id)}
          />
        ))}
        <div ref={bottom} />
      </div>

      <div className={styles.inputArea}>
        <div
          onKeyDown={e => {
            // Ctrl+Enter, not Enter: the composer is a rich editor and Enter is
            // how you start a new line in one.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void post(); }
          }}
        >
          <RichTextEditor
            value={text}
            onChange={setText}
            placeholder={me ? 'Add a comment… (Ctrl+Enter to submit)' : 'Add a comment…'}
            people={people}
          />
        </div>

        {error && <div className={styles.submitError}>{error}</div>}

        <div className={styles.inputActions}>
          <button className={styles.submitBtn} disabled={busy || !text.trim() || !me} onClick={post}>
            {busy ? 'Posting…' : 'Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One comment, with its own translation state — held in the thread it would be
 * a map keyed by comment id, which is the same thing written worse.
 */
function CommentRow({ comment, me, onLike, onDelete }: {
  comment: Comment;
  me: string | null;
  onLike: () => void;
  onDelete: () => void;
}) {
  const translation = useTranslation();
  const liked = Boolean(me && comment.likedBy.includes(me));
  const shown = translation.showing && translation.text !== null ? translation.text : comment.body;

  return (
    <div className={styles.comment}>
      <span className={styles.avatar} style={{ background: authorColor(comment.author) }}>
        {comment.author.charAt(0).toUpperCase()}
      </span>

      <div className={styles.commentBody}>
        <div className={styles.commentMeta}>
          <strong className={styles.commentAuthor}>{comment.author}</strong>
          <span className={styles.commentTime} title={new Date(comment.createdAt).toLocaleString()}>
            {formatRelativeTime(comment.createdAt)}
          </span>
          <button
            className={styles.translateBtn}
            disabled={translation.busy}
            onClick={() => translation.toggle(comment.body)}
            title="Hebrew and English, both ways"
          >
            {translation.busy ? '…' : translation.showing ? 'original' : 'translate'}
          </button>
          {comment.author === me && (
            <button className={styles.deleteBtn} onClick={onDelete} title="Delete">×</button>
          )}
        </div>

        <div
          className={styles.commentContent}
          dir={isMostlyHebrew(shown) ? 'rtl' : 'ltr'}
          dangerouslySetInnerHTML={{ __html: highlightMentions(sanitize(shown)) }}
        />

        {translation.error && <div className={styles.submitError}>{translation.error}</div>}
      </div>

      {me && (
        <button
          className={`${styles.likeBtn} ${liked ? styles.liked : ''}`}
          onClick={onLike}
          title={comment.likedBy.length ? `Liked by ${comment.likedBy.join(', ')}` : 'Like'}
        >
          {liked ? '❤️' : '🤍'}
          {comment.likedBy.length > 0 && <span className={styles.likeCount}>{comment.likedBy.length}</span>}
        </button>
      )}
    </div>
  );
}
