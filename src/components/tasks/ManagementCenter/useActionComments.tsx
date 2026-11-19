import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Task } from '../../../types/task';
import type { BoardEvent } from '../../../hooks/useBoardStream';
import { useCommenterIdentity } from '../../../hooks/useCommenterIdentity';
import { getAssignees, updateAgendaLine } from '../../../services/taskService';
import { addAgendaComment, deleteAgendaComment, editAgendaComment, listAgendaComments } from '../../../services/agendaCommentsService';
import type { AgendaComment } from '../../../services/agendaCommentsService';
import { Avatar } from './CommentThread';
import { OWNER, buildThreads, lineRefOf, personName, sameName, sayError } from './commentModel';
import type { LineRef, ThreadEntry } from './commentModel';
import { CloseIcon } from './icons';
import { RichText } from './Linkify';
import { textDir } from './textDir';
import type { LineBlock, Topic } from './topics';
import styles from './ManagementCenter.module.css';

/**
 * Comments on a meeting's action items — one more level under each line, on
 * the center's ACTION ITEMS panel and on the shared page /tasks/actions.
 *
 *  • Data: agenda_line_comments (server: services/agendaComments.service.js);
 *    which line a comment belongs to: commentModel.ts.
 *  • Who: the board identity (localStorage `aspect_commenter_identity`, the
 *    same name the task board and What's New use). Asked once, in a modal,
 *    from the board's team list.
 *  • Writing, editing and removing happen in modals (returned as `modals`);
 *    buttons are disabled in place while saving and errors take a reserved
 *    line, so nothing jumps. The author edits their own; the author or
 *    Shlomi removes (the server checks the same rule). An old note folded in
 *    as Shlomi's remark is edited / removed through the agenda-line note.
 *  • Live: the caller feeds board-stream events to onBoardEvent; a re-read on
 *    returning to the tab and every minute is the safety net.
 *
 * `onTask` / `onError` should be stable (useCallback).
 */

const POLL_MS = 60_000;
const HIDDEN_NAMES = ['claude', 'limbo'];

type Composer = {
  mode: 'add' | 'edit' | 'note';
  lineText: string;
  line: LineRef | null;
  comment: AgendaComment | null;
  value: string;
  initial: string;
};
type Confirm = { entry: ThreadEntry; lineText: string; line: LineRef | null };

export function useActionComments(taskIds: number[], { onTask, onError }: { onTask: (task: Task) => void; onError: (msg: string) => void }) {
  const { identity, setIdentity } = useCommenterIdentity();
  const [comments, setComments] = useState<AgendaComment[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [saving, setSaving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ then: ((name: string) => void) | null } | null>(null);
  const [team, setTeam] = useState<string[] | null>(null);

  const idsKey = [...new Set(taskIds)].sort((a, b) => a - b).join(',');

  const load = useCallback(() => {
    const ids = idsKey ? idsKey.split(',').map(Number) : [];
    if (ids.length === 0) { setComments([]); return; }
    listAgendaComments(ids)
      .then(list => { setComments(list); setLoadFailed(false); })
      .catch(() => setLoadFailed(true));
  }, [idsKey]);

  useEffect(() => { load(); }, [load]);

  // Safety net: board events live on one server instance, and phones drop the stream asleep.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [load]);

  const onBoardEvent = useCallback((event: BoardEvent) => {
    if (event.type !== 'agenda_comment' || !idsKey.split(',').includes(String(event.taskId))) return;
    setComments(prev => {
      if (!prev) return prev;
      if (event.action === 'deleted') return prev.filter(c => c.id !== event.id);
      const incoming = event.comment;
      if (prev.some(c => c.id === incoming.id)) return prev.map(c => (c.id === incoming.id ? incoming : c));
      return event.action === 'added' ? [...prev, incoming] : prev;
    });
  }, [idsKey]);

  const threadsFor = useCallback((topic: Topic) => buildThreads(topic, comments || []), [comments]);

  // ── Who is writing ──
  useEffect(() => {
    if (!asking || team !== null) return;
    let cancelled = false;
    getAssignees()
      .then(list => { if (!cancelled) setTeam(list.map(a => a.name).filter(n => !HIDDEN_NAMES.includes(n.toLowerCase()))); })
      .catch(() => { if (!cancelled) setTeam([]); });
    return () => { cancelled = true; };
  }, [asking, team]);

  const withName = (then: (name: string) => void) => {
    if (identity) then(identity);
    else setAsking({ then });
  };
  const changeName = () => setAsking({ then: null });
  const pickName = (name: string) => {
    setIdentity(name);
    const then = asking?.then;
    setAsking(null);
    if (then) then(name);
  };

  const allowedEdit = (entry: ThreadEntry, name: string) =>
    entry.kind === 'comment' ? sameName(entry.author, name) : sameName(name, OWNER);
  const allowedDelete = (entry: ThreadEntry, name: string) => sameName(entry.author, name) || sameName(name, OWNER);
  /** Without a name yet the buttons show; the click asks for it, then checks. */
  const mayEdit = (entry: ThreadEntry) => !identity || allowedEdit(entry, identity);
  const mayDelete = (entry: ThreadEntry) => !identity || allowedDelete(entry, identity);

  // ── Starting an action ──
  const startAdd = (topic: Topic, line: LineBlock) => withName(() => {
    setComposerError(null);
    setComposer({ mode: 'add', lineText: line.text, line: lineRefOf(topic, line), comment: null, value: '', initial: '' });
  });

  const startEdit = (entry: ThreadEntry, lineText: string, line: LineRef | null) => withName(name => {
    if (!allowedEdit(entry, name)) { onError('אפשר לשנות רק תגובות שלך.'); return; }
    setComposerError(null);
    setComposer(entry.kind === 'comment'
      ? { mode: 'edit', lineText, line, comment: entry.comment, value: entry.body, initial: entry.body }
      : { mode: 'note', lineText, line, comment: null, value: entry.body, initial: entry.body });
  });

  const startDelete = (entry: ThreadEntry, lineText: string, line: LineRef | null) => withName(name => {
    if (!allowedDelete(entry, name)) { onError('אפשר למחוק רק תגובות שלך.'); return; }
    setConfirmError(null);
    setConfirm({ entry, lineText, line });
  });

  // ── Saving ──
  const closeComposer = () => { if (!saving) setComposer(null); };

  const save = async () => {
    if (!composer || saving) return;
    const value = composer.value.trim();
    if (!value) return;
    if (composer.mode !== 'add' && value === composer.initial.trim()) { setComposer(null); return; }
    if (!identity) { changeName(); return; }
    setSaving(true);
    setComposerError(null);
    try {
      if (composer.mode === 'add' && composer.line) {
        const { comment, task } = await addAgendaComment({ ...composer.line, author: identity, body: value });
        setComments(prev => (prev && !prev.some(c => c.id === comment.id) ? [...prev, comment] : prev));
        onTask(task);
      } else if (composer.mode === 'edit' && composer.comment) {
        const comment = await editAgendaComment(composer.comment.id, identity, value);
        setComments(prev => prev && prev.map(c => (c.id === comment.id ? comment : c)));
      } else if (composer.mode === 'note' && composer.line) {
        onTask(await updateAgendaLine(composer.line.taskId, { index: composer.line.index, text: composer.line.text, note: value }));
      }
      setComposer(null);
    } catch (err) {
      setComposerError(sayError(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm || deleting || !identity) return;
    const { entry, line } = confirm;
    setDeleting(true);
    setConfirmError(null);
    try {
      if (entry.kind === 'comment') {
        await deleteAgendaComment(entry.comment.id, identity);
        setComments(prev => prev && prev.filter(c => c.id !== entry.comment.id));
      } else if (line) {
        onTask(await updateAgendaLine(line.taskId, { index: line.index, text: line.text, note: '' }));
      }
      setConfirm(null);
    } catch (err) {
      setConfirmError(sayError(err));
    } finally {
      setDeleting(false);
    }
  };

  const composerKeys = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
  };

  // Esc closes the top modal (name picker → confirm → composer).
  useEffect(() => {
    if (!composer && !confirm && !asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (asking) setAsking(null);
      else if (confirm && !deleting) setConfirm(null);
      else if (composer && !saving) setComposer(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [composer, confirm, asking, saving, deleting]);

  const composerTitle = composer?.mode === 'add' ? 'תגובה חדשה' : composer?.mode === 'edit' ? 'עריכת תגובה' : 'עריכת הערה';
  const isNoteEntry = confirm?.entry.kind === 'note';

  const modals = (
    <>
      {composer && (
        <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) closeComposer(); }}>
          <div className={`${styles.modal} ${styles.commentModal}`} role="dialog" aria-modal="true" aria-label={composerTitle}>
            <div className={styles.modalHead} dir="ltr">
              <span className={`${styles.label} ${styles.labelActions}`}>{composer.mode === 'note' ? 'NOTE' : 'COMMENT'}</span>
              <span className={styles.modalTitle} dir="rtl">{composerTitle}</span>
              <span className={styles.spacer} />
              <button type="button" className={styles.closeBtn} aria-label="סגירה" title="סגירה (Esc)" onClick={closeComposer} disabled={saving}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.modalLine} dir={textDir(composer.lineText)}><RichText text={composer.lineText} /></div>
            <textarea
              className={styles.modalInput}
              autoFocus
              rows={composer.mode === 'note' ? 3 : 5}
              placeholder="כתיבת תגובה…"
              value={composer.value}
              readOnly={saving}
              onChange={e => setComposer({ ...composer, value: e.target.value })}
              onKeyDown={composerKeys}
            />
            <div className={styles.modalMeta} dir="rtl">
              <span className={styles.modalWho}>
                {identity && <Avatar name={identity} size={22} />}
                <span>{identity ? `בשם ${personName(identity)}` : 'עוד לא נבחר שם'}</span>
                {composer.mode === 'add' && (
                  <button type="button" className={styles.linkBtn} onClick={changeName} disabled={saving}>החלפה</button>
                )}
              </span>
              <span className={styles.modalHint} dir="ltr">Ctrl+Enter</span>
            </div>
            <div className={styles.modalError} role="alert">{composerError || ''}</div>
            <div className={styles.modalActions}>
              <button type="button" className={`${styles.primaryBtn} ${styles.fixedBtn}`} onClick={() => void save()} disabled={saving || !composer.value.trim()}>
                {saving ? 'שומר…' : 'שמירה'}
              </button>
              <button type="button" className={styles.ghostBtn} onClick={closeComposer} disabled={saving}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget && !deleting) setConfirm(null); }}>
          <div className={`${styles.modal} ${styles.confirmModal}`} role="alertdialog" aria-modal="true" aria-label={isNoteEntry ? 'מחיקת הערה' : 'מחיקת תגובה'}>
            <div className={styles.modalHead} dir="ltr">
              <span className={`${styles.label} ${styles.labelDanger}`}>DELETE</span>
              <span className={styles.modalTitle} dir="rtl">{isNoteEntry ? 'מחיקת הערה' : 'מחיקת תגובה'}</span>
              <span className={styles.spacer} />
            </div>
            <div className={styles.confirmQuote} dir="rtl">
              <span className={styles.confirmWho}>
                <Avatar name={confirm.entry.author} size={22} /> {personName(confirm.entry.author)}
              </span>
              <p className={styles.confirmBody} dir="auto">{confirm.entry.body}</p>
            </div>
            <div className={styles.modalError} role="alert">{confirmError || ''}</div>
            <div className={styles.modalActions}>
              <button type="button" className={`${styles.dangerSolidBtn} ${styles.fixedBtn}`} onClick={() => void remove()} disabled={deleting} autoFocus>
                {deleting ? 'מוחק…' : 'מחיקה'}
              </button>
              <button type="button" className={styles.ghostBtn} onClick={() => setConfirm(null)} disabled={deleting}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {asking && (
        <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) setAsking(null); }}>
          <div className={`${styles.modal} ${styles.nameModal}`} role="dialog" aria-modal="true" aria-label="בחירת שם">
            <div className={styles.modalHead} dir="ltr">
              <span className={styles.label}>WHO</span>
              <span className={styles.modalTitle} dir="rtl">בחירת שם</span>
              <span className={styles.spacer} />
              <button type="button" className={styles.closeBtn} aria-label="סגירה" title="סגירה (Esc)" onClick={() => setAsking(null)}>
                <CloseIcon />
              </button>
            </div>
            <p className={styles.nameHint}>פעם אחת, והדפדפן יזכור.</p>
            <div className={styles.nameList}>
              {team === null && <><div className={styles.skeletonBar} /><div className={styles.skeletonBar} /><div className={styles.skeletonBar} /></>}
              {team !== null && team.length === 0 && <div className={styles.empty}>לא הצלחתי לטעון את רשימת הצוות.</div>}
              {team?.map(name => (
                <button
                  key={name}
                  type="button"
                  className={`${styles.nameBtn} ${sameName(name, identity) ? styles.nameBtnOn : ''}`}
                  onClick={() => pickName(name)}
                >
                  <Avatar name={name} size={30} />
                  <span>{personName(name)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );

  return {
    identity,
    comments,
    loadFailed,
    reload: load,
    onBoardEvent,
    threadsFor,
    mayEdit,
    mayDelete,
    startAdd,
    startEdit,
    startDelete,
    changeName,
    modals,
  };
}

export type ActionComments = ReturnType<typeof useActionComments>;
