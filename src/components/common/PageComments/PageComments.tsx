/**
 * Review notes for internal spec / explainer pages.
 *
 * Deliberately the smallest thing that works: sign your name, write a note, it
 * appears under that section for everyone. No auth, no threads, no editing, no
 * notifications — these pages are documents we hand to a colleague or a client
 * by link, and the point is that they can mark up a specific part without
 * leaving the page.
 *
 * READING and WRITING are separate affordances on purpose. A single "comments"
 * toggle made "see what people said" and "say something" the same click, so
 * opening to read dropped you into an empty form.
 *
 * The note surface is deliberately NOT the host page's panel colour: a note
 * written on a document should read as something laid ON the page — a RAISED
 * ground (lighter than the page in dark, plain white in light), a pen-coloured
 * spine down the inline-start edge, a real shadow — rather than as another
 * section of it. A warm cream-and-amber treatment was tried first and clashed
 * badly with these cool-toned pages, so the pen colour is the host page's own
 * accent. Everything else comes from the host page's tokens too, so the note
 * still belongs to the page it sits on.
 *
 * `global.css` styles every input/textarea and puts a rounded 3px ring on
 * :focus. Inline styles win, so the fields here neutralise `boxShadow` and
 * `borderRadius` explicitly rather than fighting that rule with a selector.
 *
 * Usage: wrap the page in <PageCommentsProvider pageKey="..." t={tokens}> and
 * drop <SectionComments sectionId="..." /> at the end of each section. The
 * provider fetches once for the whole page, so N sections cost one request.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getBaseURL } from '../../../services/api';
// Imported from its own folder, not the common barrel, to avoid an import cycle.
import { ConfirmDialog } from '../ConfirmDialog';

export interface CommentTokens {
  border: string;
  text: string;
  faint: string;
  /** The annotation ground — raised, distinct from the page's own panels. */
  paper: string;
  paperBorder: string;
  /** The "pen" colour: the note's spine, its avatar ring, its primary action. */
  noteAccent: string;
  /** Font for body text. The two host pages use different families. */
  font: string;
  /** 'rtl' on the Hebrew page — affects alignment only. */
  dir?: 'rtl' | 'ltr';
  /** UI strings, so the Hebrew page reads Hebrew. */
  strings?: Partial<CommentStrings>;
}

interface CommentStrings {
  /** Reading affordance — only rendered when there is something to read. */
  one: string;
  many: string;      // "{n} notes"
  hide: string;
  /** Writing affordance — always rendered, visually separate from reading. */
  add: string;
  name: string;
  placeholder: string;
  send: string;
  sending: string;
  cancel: string;
  remove: string;
  removeTitle: string;
  removeConfirm: string;
  failed: string;
  loading: string;
}

const EN: CommentStrings = {
  one: '1 note',
  many: '{n} notes',
  hide: 'Hide notes',
  add: 'Add a note',
  name: 'Your name',
  placeholder: 'Anything to add or emphasise about this part?',
  send: 'Post',
  sending: 'Posting…',
  cancel: 'Cancel',
  remove: 'Delete',
  removeTitle: 'Delete note',
  removeConfirm: 'This removes the note for everyone. It cannot be undone.',
  failed: 'Could not save. Try again.',
  loading: 'Loading…',
};

export interface PageComment {
  id: number;
  pageKey: string;
  sectionId: string;
  author: string;
  body: string;
  createdAt: string;
}

interface Ctx {
  bySection: Record<string, PageComment[]>;
  loading: boolean;
  add: (sectionId: string, author: string, body: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
  t: CommentTokens;
  s: CommentStrings;
}

const CommentsContext = createContext<Ctx | null>(null);

const NAME_KEY = 'aspect_page_comment_author';

export function PageCommentsProvider({ pageKey, t, children }: { pageKey: string; t: CommentTokens; children: ReactNode }) {
  const [comments, setComments] = useState<PageComment[]>([]);
  const [loading, setLoading] = useState(true);
  const base = getBaseURL();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${base}/api/page-comments/${pageKey}`)
      .then(r => (r.ok ? r.json() : { comments: [] }))
      .then(d => { if (!cancelled) setComments(Array.isArray(d.comments) ? d.comments : []); })
      // A page that cannot reach the server still has to READ correctly —
      // the document is the point, the notes are an extra.
      .catch(() => { if (!cancelled) setComments([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [base, pageKey]);

  const add = useCallback(async (sectionId: string, author: string, body: string) => {
    const res = await fetch(`${base}/api/page-comments/${pageKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId, author, body }),
    });
    if (!res.ok) throw new Error('save failed');
    const { comment } = await res.json();
    setComments(prev => [...prev, comment]);
    try { localStorage.setItem(NAME_KEY, author); } catch { /* private mode */ }
  }, [base, pageKey]);

  const remove = useCallback(async (id: number) => {
    const res = await fetch(`${base}/api/page-comments/${pageKey}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('delete failed');
    setComments(prev => prev.filter(c => c.id !== id));
  }, [base, pageKey]);

  const bySection = useMemo(() => {
    const map: Record<string, PageComment[]> = {};
    for (const c of comments) (map[c.sectionId] ||= []).push(c);
    return map;
  }, [comments]);

  const s = useMemo(() => ({ ...EN, ...(t.strings || {}) }), [t.strings]);

  return (
    <CommentsContext.Provider value={{ bySection, loading, add, remove, t, s }}>
      {children}
    </CommentsContext.Provider>
  );
}

function fmtDate(iso: string, rtl: boolean) {
  try {
    return new Intl.DateTimeFormat(rtl ? 'he-IL' : 'en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

/** Circle with the writer's initial — gives a note a face at a glance. */
function Avatar({ name, t }: { name: string; t: CommentTokens }) {
  const ch = (name.trim()[0] || '✎').toUpperCase();
  return (
    <span aria-hidden style={{
      flexShrink: 0, width: 25, height: 25, borderRadius: '50%',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: t.font, fontSize: 12, fontWeight: 700, lineHeight: 1,
      color: t.noteAccent, background: 'transparent',
      border: `1.5px solid ${t.noteAccent}`,
    }}>{ch}</span>
  );
}

export function SectionComments({ sectionId }: { sectionId: string }) {
  const ctx = useContext(CommentsContext);
  const [showList, setShowList] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [author, setAuthor] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
  });
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Our own confirm dialog, never window.confirm — house rule.
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  if (!ctx) return null;
  const { bySection, loading, add, remove, t, s } = ctx;
  const rtl = t.dir === 'rtl';
  const list = bySection[sectionId] || [];
  const count = list.length;
  const canSend = !!author.trim() && !!body.trim() && !busy;

  const countLabel = count === 1 ? s.one : s.many.replace('{n}', String(count));

  const submit = async () => {
    if (!canSend) return;
    setBusy(true);
    setError('');
    try {
      await add(sectionId, author.trim(), body.trim());
      setBody('');
      setShowForm(false);
      setShowList(true);   // land on the note you just wrote
    } catch {
      setError(s.failed);
    } finally {
      setBusy(false);
    }
  };

  const pill: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
    fontFamily: t.font, fontSize: 12.5, lineHeight: 1.6,
    borderRadius: 999, padding: '5px 13px',
  };

  /** Shared note surface — spine on the inline-start edge, lifted off the page. */
  const paper: React.CSSProperties = {
    marginTop: 10,
    background: t.paper,
    border: `1px solid ${t.paperBorder}`,
    borderInlineStart: `3px solid ${t.noteAccent}`,
    borderStartStartRadius: 4,
    borderEndStartRadius: 4,
    borderStartEndRadius: 12,
    borderEndEndRadius: 12,
    boxShadow: '0 3px 14px rgba(0,0,0,0.18)',
  };

  return (
    <div style={{ margin: '22px 0 34px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* READ — only exists when there is something to read. */}
        {count > 0 && (
          <button
            onClick={() => setShowList(v => !v)}
            style={{
              ...pill,
              color: t.noteAccent, background: t.paper,
              border: `1px solid ${t.paperBorder}`, fontWeight: 700,
            }}>
            <span aria-hidden>💬</span>
            <span>{showList ? s.hide : countLabel}</span>
          </button>
        )}

        {/* WRITE — always available, and clearly a different action. */}
        <button
          onClick={() => { setShowForm(v => !v); setError(''); }}
          style={{
            ...pill,
            color: showForm ? t.noteAccent : t.faint,
            background: 'transparent',
            border: `1px dashed ${showForm ? t.noteAccent : t.border}`,
          }}>
          <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>✎</span>
          <span>{s.add}</span>
        </button>

        {loading && (
          <span style={{ fontFamily: t.font, fontSize: 12, color: t.faint }}>{s.loading}</span>
        )}
      </div>

      {showList && count > 0 && (
        <div style={{ ...paper, padding: '2px 16px' }}>
          {list.map((c, i) => (
            <div key={c.id} style={{
              padding: '13px 0',
              borderBottom: i === list.length - 1 ? 'none' : `1px solid ${t.paperBorder}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                <Avatar name={c.author} t={t} />
                <span style={{ fontFamily: t.font, fontSize: 13.5, fontWeight: 700, color: t.text }}>{c.author}</span>
                <span style={{ fontFamily: t.font, fontSize: 11.5, color: t.faint }}>{fmtDate(c.createdAt, rtl)}</span>
                <button
                  onClick={() => setPendingDelete(c.id)}
                  style={{
                    marginInlineStart: 'auto', cursor: 'pointer', fontFamily: t.font, fontSize: 11.5,
                    color: t.faint, background: 'transparent', border: 'none', padding: 0,
                  }}>
                  {s.remove}
                </button>
              </div>
              <div style={{
                fontFamily: t.font, fontSize: 14.5, lineHeight: 1.8, color: t.text,
                whiteSpace: 'pre-wrap', paddingInlineStart: 34,
              }}>
                {c.body}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ ...paper, padding: '13px 16px 11px' }}>
          {/* Signature line: avatar + a narrow underlined name, not a boxed input. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <Avatar name={author} t={t} />
            <input
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder={s.name}
              maxLength={100}
              style={{
                width: 148, boxSizing: 'border-box',
                fontFamily: t.font, fontSize: 13.5, fontWeight: 700, color: t.text,
                background: 'transparent', border: 'none',
                borderBottom: `1px solid ${t.paperBorder}`,
                borderRadius: 0, padding: '3px 2px', outline: 'none', boxShadow: 'none',
                textAlign: rtl ? 'right' : 'left', direction: t.dir || 'ltr',
              }}
            />
          </div>

          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={s.placeholder}
            rows={3}
            maxLength={4000}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); }}
            style={{
              width: '100%', boxSizing: 'border-box', display: 'block',
              fontFamily: t.font, fontSize: 14.5, lineHeight: 1.8, color: t.text,
              background: 'transparent', border: 'none', outline: 'none',
              boxShadow: 'none', borderRadius: 0,
              padding: '0 2px', resize: 'vertical', minHeight: 64,
              textAlign: rtl ? 'right' : 'left', direction: t.dir || 'ltr',
            }}
          />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 8, paddingTop: 10, borderTop: `1px solid ${t.paperBorder}`,
          }}>
            {/* Flexible slot so the row never reflows when the error appears. */}
            <span style={{ flex: 1, minWidth: 0, fontFamily: t.font, fontSize: 12, color: t.noteAccent }}>{error}</span>
            <button
              onClick={() => { setShowForm(false); setBody(''); setError(''); }}
              style={{
                cursor: 'pointer', fontFamily: t.font, fontSize: 13,
                color: t.faint, background: 'transparent', border: 'none',
                padding: '6px 10px',
              }}>
              {s.cancel}
            </button>
            <button
              onClick={submit}
              disabled={!canSend}
              style={{
                cursor: canSend ? 'pointer' : 'default',
                fontFamily: t.font, fontSize: 13, fontWeight: 700,
                color: t.paper, background: t.noteAccent, border: `1px solid ${t.noteAccent}`,
                borderRadius: 7, padding: '6px 18px',
                opacity: canSend ? 1 : 0.45,
              }}>
              {busy ? s.sending : s.send}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={s.removeTitle}
        message={s.removeConfirm}
        confirmText={s.remove}
        cancelText={s.cancel}
        variant="danger"
        onConfirm={() => {
          const id = pendingDelete;
          setPendingDelete(null);
          if (id !== null) remove(id).catch(() => {});
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
