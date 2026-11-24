import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Task } from '../../../types/task';
import { getTasks } from '../../../services/taskService';
import { useBoardStream } from '../../../hooks/useBoardStream';
import { Avatar, CommentThread, OrphanThreads } from './CommentThread';
import { personName } from './commentModel';
import { useActionComments } from './useActionComments';
import type { TopicThreads } from './commentModel';
import { CheckIcon, CommentIcon } from './icons';
import { RichText } from './Linkify';
import { textDir } from './textDir';
import { Threads } from './Threads';
import { ACTIONS_PREFIX, topicsTagged } from './topics';
import type { LineBlock, Topic } from './topics';
import styles from './ManagementCenter.module.css';

/**
 * משימות מהפגישה — /tasks/actions. The page Shlomi sends Noa and Hila: the
 * meeting's action items (agenda topics tagged actionsFor:<who>, the same
 * list as the center's ACTION ITEMS panel), each line with its comment
 * thread always open, so they comment right there.
 *
 *  • Topics → lines → comments (who · when · text). Writing, editing and
 *    removing happen in modals (useActionComments.tsx); the author edits their
 *    own, the author or Shlomi removes.
 *  • A line's tick is shown, not changed here: ticking stays Shlomi's, on the
 *    center. Topic text is never edited.
 *  • The name is the board identity, asked once per browser.
 *  • Live through the board stream; re-read on returning to the tab.
 *  • Same look as the center (its CSS module), but the page scrolls as a
 *    document — it is read on phones too.
 */

const LOGO_SRC = '/lybi-site/team/img/lybi-wordmark-white.svg';

function withDates(task: Task): Task {
  return { ...task, createdAt: new Date(task.createdAt), updatedAt: new Date(task.updatedAt) };
}

export function ActionItemsPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    getTasks({ type: 'agenda' })
      .then(list => { setTasks(list); setLoadError(false); })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  useEffect(() => {
    const before = document.title;
    document.title = 'משימות מהפגישה · Lybi';
    return () => { document.title = before; };
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const upsert = useCallback((task: Task) => {
    const t = withDates(task);
    setTasks(prev => {
      if (!prev) return prev;
      return prev.some(x => x.id === t.id) ? prev.map(x => (x.id === t.id ? t : x)) : [...prev, t];
    });
  }, []);

  const topics = useMemo(() => topicsTagged(tasks, ACTIONS_PREFIX), [tasks]);
  const comments = useActionComments(topics.map(t => t.task.id), { onTask: upsert, onError: showToast });

  useBoardStream(true, event => {
    if ((event.type === 'task_created' || event.type === 'task_updated') && event.task.type === 'agenda') upsert(event.task);
    comments.onBoardEvent(event);
  });

  const open = topics.reduce((n, t) => n + t.total - t.ticked, 0);

  const renderLine = (t: Topic, line: LineBlock, threads: TopicThreads) => {
    const thread = threads.byIndex.get(line.index) ?? [];
    const lineDir = textDir(line.text);
    const hasDetails = line.quotes.length > 0 || line.details.length > 0;
    return (
      <li key={`l${line.index}`} className={`${styles.sub} ${styles.shareLine} ${line.checked ? styles.subDone : ''}`}>
        <div className={styles.subRow}>
          <span className={`${styles.check} ${styles.checkStatic}`} role="img" aria-label={line.checked ? 'בוצע' : 'פתוח'} title={line.checked ? 'בוצע' : 'פתוח'}>
            <span className={styles.box}>{line.checked && <CheckIcon size={13} />}</span>
          </span>
          <span className={styles.subText} dir={lineDir}><RichText text={line.text} /></span>
          <span className={styles.shareCount} title={thread.length ? `${thread.length} תגובות` : 'אין תגובות עדיין'}>
            {thread.length > 0 && <><CommentIcon size={15} /> {thread.length}</>}
          </span>
        </div>
        {hasDetails && (
          <ul className={styles.details} dir={lineDir}>
            {[...line.quotes, ...line.details].map((d, i) => (
              <li key={i}><span className={styles.iso} dir={textDir(d)}><RichText text={d} /></span></li>
            ))}
          </ul>
        )}
        <CommentThread flow={comments} entries={thread} lineText={line.text} line={line} topic={t} />
      </li>
    );
  };

  const renderTopic = (t: Topic) => {
    const threads = comments.threadsFor(t);
    return (
      // One standing list: the items show directly; `**group**` lines group related items.
      <section key={t.task.id} className={`${styles.topic} ${styles.shareTopic}`}>
        <ul className={`${styles.subs} ${styles.shareLines} ${styles.actionSubs}`}>
          {t.blocks.map((b, i) => {
            if (b.kind === 'line') return renderLine(t, b, threads);
            if (b.kind === 'heading') return <li key={`h${i}`} className={`${styles.group} ${styles.actionGroup}`} dir={textDir(b.text)}>{b.text}</li>;
            return <li key={`t${i}`} className={styles.smallText} dir={textDir(b.text)}><RichText text={b.text} /></li>;
          })}
        </ul>
        <OrphanThreads flow={comments} topic={t} orphans={threads.orphans} />
      </section>
    );
  };

  return (
    <div className={`${styles.page} ${styles.sharePage}`} dir="rtl">
      <div className={styles.bg} aria-hidden="true">
        <Threads />
      </div>
      <span className={`${styles.corner} ${styles.cTL}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cTR}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cBL}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cBR}`} aria-hidden="true" />

      <header className={`${styles.topbar} ${styles.shareTop}`}>
        <div className={styles.brand}>
          <img className={styles.logo} src={LOGO_SRC} alt="Lybi" />
          <span className={`${styles.vsep} ${styles.vsepTall}`} />
          <h1 className={styles.title}>משימות מהפגישה</h1>
        </div>
        <div className={styles.shareWho}>
          {comments.identity ? (
            <>
              <Avatar name={comments.identity} size={26} />
              <span>בשם {personName(comments.identity)}</span>
              <button type="button" className={styles.linkBtn} onClick={comments.changeName}>החלפה</button>
            </>
          ) : (
            <button type="button" className={styles.allToggle} onClick={comments.changeName}>בחירת שם</button>
          )}
        </div>
      </header>

      <main className={styles.shareMain}>
        <section className={`${styles.panel} ${styles.actionsPanel} ${styles.sharePanel}`} aria-label="משימות מהפגישה">
          <div className={styles.panelHead} dir="ltr">
            <span className={`${styles.label} ${styles.labelActions}`}>ACTION ITEMS</span>
            <span className={styles.rule} />
            {tasks && <span className={styles.actionsCount} dir="rtl">{open} פתוחות</span>}
            <span className={styles.marks}>///</span>
          </div>
          <div className={styles.shareList} dir="rtl">
            {loadError && !tasks && (
              <div className={styles.empty}>
                לא הצלחתי לטעון.{' '}
                <button type="button" className={styles.linkBtn} onClick={load}>לנסות שוב</button>
              </div>
            )}
            {!tasks && !loadError && (
              <div className={styles.skeleton} aria-label="טוען">
                <div className={styles.skeletonBar} />
                <div className={styles.skeletonBar} />
                <div className={styles.skeletonBar} />
              </div>
            )}
            {tasks && topics.length === 0 && <div className={styles.empty}>אין כרגע משימות מהפגישה.</div>}
            {comments.loadFailed && topics.length > 0 && (
              <div className={styles.empty}>
                התגובות לא נטענו.{' '}
                <button type="button" className={styles.linkBtn} onClick={comments.reload}>לנסות שוב</button>
              </div>
            )}
            {topics.filter(t => !t.done).map(renderTopic)}
          </div>
        </section>
      </main>

      {comments.modals}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  );
}
