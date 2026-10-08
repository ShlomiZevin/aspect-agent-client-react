/**
 * "מה חדש" — the customer's release-notes popup (task #102).
 *
 * Shows the notes Shlomi published since this user last pressed "הבנתי", and
 * opens by itself when there are any: on arriving, and on coming back to the
 * tab after a long break. Closing it any other way only hides it until the next
 * visit — the notes stay unseen until "הבנתי".
 *
 * Always Hebrew and RTL, whatever the EN/HE toggle says: the notes are written
 * in Hebrew and there are no English-only customers (Shlomi, 2026-10-08).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { releaseNotesService, type ReleaseNote } from '../../services/releaseNotesService';
import styles from './ReleaseNotesPopup.module.css';

/** Hidden this long counts as coming back, and re-checks for new notes. */
const AWAY_MS = 20 * 60 * 1000;

interface Props {
  userId: string | null;
  baseURL?: string;
}

function countLabel(n: number): string {
  return n === 1 ? 'עדכון חדש אחד' : `${n} עדכונים חדשים`;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
}

export function ReleaseNotesPopup({ userId, baseURL }: Props) {
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [open, setOpen] = useState(false);

  // Checks on arrival, and again on coming back to the tab after a long break,
  // like the LYBI popup. The fetch lives inside the effect (not a callback it
  // calls) so the cancelled flag can stop a late answer from a previous user id.
  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const check = () => {
      releaseNotesService.unseen(userId, baseURL)
        .then(list => {
          if (cancelled) return;
          setNotes(list);
          if (list.length > 0) setOpen(true);
        })
        // A "what's new" list is never worth an error on a customer's screen.
        .catch(() => {});
    };

    const onVisibility = () => {
      if (document.hidden) { hiddenAt.current = Date.now(); return; }
      const away = hiddenAt.current !== null && Date.now() - hiddenAt.current >= AWAY_MS;
      hiddenAt.current = null;
      if (away) check();
    };

    check();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, baseURL]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // The watermark is the newest note SHOWN, not "now": a note published while
  // the popup was open still shows next time.
  const gotIt = async () => {
    setOpen(false);
    if (!userId || notes.length === 0) return;
    const newest = notes.reduce(
      (max, n) => (new Date(n.publishedAt) > new Date(max) ? n.publishedAt : max),
      notes[0].publishedAt,
    );
    setNotes([]);
    try {
      await releaseNotesService.markSeen(userId, newest, baseURL);
    } catch {
      // Not marked: the same notes show again next visit, which is harmless.
    }
  };

  if (!open || notes.length === 0) return null;

  return (
    <div
      className={styles.overlay}
      dir="rtl"
      lang="he"
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden="true">🎁</span>
          <div className={styles.headerText}>
            <h3 id="release-notes-title" className={styles.title}>מה חדש</h3>
            <div className={styles.subtitle}>{countLabel(notes.length)} מאז הביקור האחרון</div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={close} aria-label="סגירה">×</button>
        </div>

        <div className={styles.body}>
          {notes.map((n, i) => (
            <article key={`${n.publishedAt}-${i}`} className={styles.item}>
              <div className={styles.headline}>{n.headline}</div>
              {n.body && <div className={styles.text}>{n.body}</div>}
              <div className={styles.date}>{dateLabel(n.publishedAt)}</div>
            </article>
          ))}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.gotIt} onClick={() => void gotIt()}>הבנתי</button>
        </div>
      </div>
    </div>
  );
}
