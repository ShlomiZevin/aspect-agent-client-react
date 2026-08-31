import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { api } from '../../api';
import type { Comment } from '../../types';
import styles from './CommentThread.module.css';

/**
 * A task's conversation.
 *
 * Comments are stored as plain text with images written as `![](data:…)`. That
 * is deliberately not the old board's approach, which stored raw HTML from a
 * contentEditable and rendered it with dangerouslySetInnerHTML — 824 lines of
 * editor to produce markup that then had to be trusted. Here the body is text,
 * the renderer only ever emits an <img> for an image token and a text node for
 * everything else, so there is nothing to sanitise and nothing to trust.
 *
 * Pasting a screenshot is the one thing that made the old editor worth its size,
 * so that is kept: paste an image and it becomes a token in the text.
 */
const MAX_IMAGE_BYTES = 1_500_000;

interface Props {
  taskId: number;
  me: string | null;
}

export function CommentThread({ taskId, me }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.listComments(taskId)
      .then(list => { if (!cancelled) setComments(list); })
      .catch(() => { if (!cancelled) setComments([]); });
    return () => { cancelled = true; };
  }, [taskId]);

  const post = async () => {
    if (!draft.trim() || !me || busy) return;
    setBusy(true);
    setError(null);
    try {
      const comment = await api.addComment(taskId, me, draft);
      setComments(c => [...c, comment]);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /** Turns a pasted screenshot into an image token at the cursor. */
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const file = [...e.clipboardData.items]
      .find(i => i.type.startsWith('image/'))?.getAsFile();
    if (!file) return;

    e.preventDefault();
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`That image is ${Math.round(file.size / 1024)} KB. Keep pastes under ${MAX_IMAGE_BYTES / 1024 | 0} KB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const token = `\n![pasted](${reader.result})\n`;
      const el = input.current;
      // Inserted at the cursor rather than appended, so a screenshot can go in
      // the middle of a sentence.
      const at = el?.selectionStart ?? draft.length;
      setDraft(d => d.slice(0, at) + token + d.slice(at));
      setError(null);
    };
    reader.readAsDataURL(file);
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
    <>
      <h3 className={styles.heading}>Comments ({comments.length})</h3>

      {comments.length === 0 && <p className={styles.empty}>No comments yet.</p>}

      {comments.map(c => (
        <article key={c.id} className={styles.comment}>
          <div className={styles.head}>
            <span className={styles.author}>{c.author}</span>
            <time className={styles.when}>{new Date(c.createdAt).toLocaleString()}</time>
          </div>

          <div className={styles.body}>{render(c.body)}</div>

          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.linkBtn} ${me && c.likedBy.includes(me) ? styles.liked : ''}`}
              onClick={() => like(c)}
              title={c.likedBy.join(', ')}
            >
              {me && c.likedBy.includes(me) ? 'Liked' : 'Like'}
              {c.likedBy.length > 0 ? ` (${c.likedBy.length})` : ''}
            </button>
            {c.author === me && (
              <button type="button" className={styles.linkBtn} onClick={() => remove(c.id)}>Delete</button>
            )}
          </div>
        </article>
      ))}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.composer}>
        <textarea
          ref={input}
          className={styles.input}
          value={draft}
          placeholder={me
            ? 'Write a comment — @name to notify, paste a screenshot to attach it'
            : 'Tell the board your name first'}
          disabled={!me}
          onChange={e => setDraft(e.target.value)}
          onPaste={onPaste}
          onKeyDown={e => {
            // Enter sends, Shift+Enter breaks the line — the convention every
            // other composer in this app uses.
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void post(); }
          }}
        />
        <button type="button" className={styles.send} disabled={busy || !draft.trim() || !me} onClick={post}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
    </>
  );
}

// Only `![alt](src)` is special, and only when src is a data: or https: image.
// Anything else stays text, which is why this cannot inject markup.
const IMAGE = /!\[[^\]]*\]\((data:image\/[a-z+]+;base64,[^\s)]+|https:\/\/[^\s)]+)\)/g;

function render(body: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  IMAGE.lastIndex = 0;
  while ((match = IMAGE.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <img key={`${match.index}`} className={styles.image} src={match[1]} alt="attachment" />,
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));

  return parts.length > 0 ? parts : body;
}
