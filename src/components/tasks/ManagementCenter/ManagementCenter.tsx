import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../../types/task';
import { getTask, getTasks, updateAgendaLine, updateTask } from '../../../services/taskService';
import { useBoardStream } from '../../../hooks/useBoardStream';
import { applyLineChange } from './agendaParse';
import { ActionSections, SectionsToggle } from './ActionSections';
import { useSectionCollapse } from './useSectionCollapse';
import { CommentThread, OrphanThreads } from './CommentThread';
import { useActionComments } from './useActionComments';
import type { TopicThreads } from './commentModel';
import { CheckIcon, ChevronIcon, CloseIcon, CommentIcon, PencilIcon, ShareIcon } from './icons';
import { Linkify, RichText } from './Linkify';
import { openProps } from './openProps';
import { TaskMarkdown } from './TaskMarkdown';
import { textDir } from './textDir';
import { Threads } from './Threads';
import { ACTIONS_PREFIX, AGENDA_PREFIX, isActionTopic, topicsTagged } from './topics';
import type { LineBlock, Topic } from './topics';
import styles from './ManagementCenter.module.css';

/**
 * מרכז הניהול של שלומי — /tasks/center ("Situation Room HUD", design C).
 * A reading-and-ticking screen for Shlomi, used during calls. One screen, two
 * panels that scroll inside themselves:
 *  • THE AGENDA (right, big) — agenda topics (type 'agenda', tagged
 *    agendaFor:<anyone>) as ONE collapsible list: topics → subtopics (the
 *    tickable `- [ ]` lines) → details (decisions, notes, `  - ` lines).
 *    Topics start open, details closed; the state is remembered per browser.
 *    Ticks and notes go through PATCH /api/tasks/:id/agenda-line, which never
 *    overwrites concurrent edits. Topic text is never edited here.
 *  • ACTION ITEMS (right, under the agenda) — what came out of a meeting:
 *    type 'agenda' tagged actionsFor:<anyone> (never agendaFor, so they stay
 *    off the agenda). Same list and ticks; a tick = done. Instead of a note,
 *    each line has a comment thread (Noa, Hila, Shlomi — who and when on
 *    every remark; an old note shows as Shlomi's remark): the speech bubble
 *    with its count opens / closes it (remembered like the details), or opens
 *    the composer when there is none yet. The head links to the shared page
 *    /tasks/actions (ActionItemsPage.tsx). Comments: useActionComments.tsx.
 *  • ONGOING (left) — open tasks Claude is on, any Blocker, and any open task
 *    with a now: tag. Tasks tagged `focus` lead as hero cards; the star on any
 *    task adds / removes only that tag. Right after them, quieter, come the
 *    tasks tagged `next` (any open task: what Shlomi takes after the focus);
 *    the "next" mark beside the star adds / removes that tag. A task is focus
 *    or next, never both. Clicking a task opens a read-only modal.
 *    A started task that is now waiting on something (status in_progress +
 *    tag `waiting`) gets its own label and a compact row whose now: line says
 *    what it waits for — also when it is in focus. A `waiting-on:<who>` tag
 *    beside `waiting` says on whom, as the row's pill: `waiting-on:us`
 *    "אצלנו – בהמתנה" (parked by our side, muted), `waiting-on:Shlomi`
 *    "מחכה לך" (him — the loudest), anything else "מחכה ל<who>" (amber;
 *    Noa → נועה, Hila → הילה, other names as written). Without it: the plain
 *    "בהמתנה". The waiting section lists him first, then outside, then us. Connected tasks (the
 *    board's `linkedTasks`, read both ways) show a chip that opens the other
 *    task, and connected focus tasks are drawn as one group. Links are
 *    read-only here.
 *    Two hand-off states sit beside them, each a compact row with one button
 *    that takes the task off this panel:
 *    – READY FOR YOU TO CHECK (top of the panel): any task tagged `check`
 *      (the team lead sets it: on staging, waiting for Shlomi's check before
 *      release). Its now: line says what to check. "נבדק" removes `check`
 *      and adds `checked`; the task stays in this section, after the ones
 *      still to check, dimmed and marked "נבדק – ממתין לשחרור" — clicking
 *      that mark undoes it (back to `check`). Once the team lead releases
 *      it, it moves to RELEASED (released wins over `checked`).
 *    – RELEASED (bottom of the panel, closed by default — its head row opens
 *      it, remembered per browser): a task released in the last 14 days —
 *      the board's own rule: status done and `deployedAt` set and not older
 *      than its `doneAt` (a reopened task is not released) — and not tagged
 *      `off-table`. "ירד מהשולחן" adds `off-table`. `deployedReviewedBy`
 *      is What's New's and is never read or written here.
 *    A task in one of these states shows ONLY there (`check` wins over
 *    released, released wins over `checked`): never as a focus card, in next, waiting or the rows, even
 *    if it still carries `focus` / `next` (see handOff()).
 *    URLs in now: lines, agenda lines, details and the task modal are real
 *    links (new tab, shortened; Linkify.tsx), so rows are not <button>s:
 *    each is a role="button" container that opens the task on click, Enter
 *    or Space, and a link inside it never opens the task.
 *    Every tag change here is optimistic, made on a fresh read that keeps all
 *    other tags, and re-read from the board if the save fails.
 * Look: the Lybi team page (public/lybi-site/team) — its font, violet tokens,
 * glow values and light threads. No sounds (Shlomi, 17.11).
 */

const PRIORITY_RANK: Record<string, number> = { blocker: 0, critical: 1, high: 2, medium: 3, low: 4 };
const PRIORITY_LABEL: Record<string, string> = { blocker: 'Blocker', critical: 'קריטי', high: 'גבוה', medium: 'בינוני', low: 'נמוך' };
const LOGO_SRC = '/lybi-site/team/img/lybi-wordmark-white.svg';
const FOCUS_TAG = 'focus';
const NEXT_TAG = 'next';
type MarkTag = typeof FOCUS_TAG | typeof NEXT_TAG;
const WAITING_TAG = 'waiting';
const WAITING_ON_PREFIX = 'waiting-on:';
/** Known names in Hebrew for "מחכה ל…"; anything else is shown as written (Google stays Google). */
const WHO_HE: Record<string, string> = { noa: 'נועה', hila: 'הילה', kosta: 'קוסטה' };
const CHECK_TAG = 'check';
const CHECKED_TAG = 'checked';
const OFF_TABLE_TAG = 'off-table';
const RELEASED_DAYS = 14;
const MAX_LINK_CHIPS = 2;
const OPEN_KEY = 'lybi-center-agenda-open';
/** RELEASED starts closed (Shlomi, 27.11: "I don't want to see them in general"); "1" = this viewer opened it. */
const RELEASED_OPEN_KEY = 'lybi-center-released-open';
/** The shared action-items page (Noa and Hila comment there). */
const ACTIONS_PAGE = '/tasks/actions';

type NoteDraft = { taskId: number; index: number; text: string; value: string; hadNote: boolean };
/**
 * Open / closed overrides: t = topic id → open, d = "<topicId>:<line index>" →
 * details open, c = "<topicId>:<line key or #index>" → comment thread open.
 */
type OpenPrefs = { t: Record<string, boolean>; d: Record<string, boolean>; c: Record<string, boolean> };

/** Focus and next exclude each other: setting one drops the other; every other tag stays. */
function withMark(tags: string[], tag: MarkTag, want: boolean): string[] {
  const other = tag === FOCUS_TAG ? NEXT_TAG : FOCUS_TAG;
  return want ? [...tags.filter(x => x !== tag && x !== other), tag] : tags.filter(x => x !== tag);
}

function withDates(task: Task): Task {
  return { ...task, createdAt: new Date(task.createdAt), updatedAt: new Date(task.updatedAt) };
}

function nowStatus(task: Task): string | null {
  const tag = task.tags.find(t => t.startsWith('now:'));
  const text = tag ? tag.slice(4).trim() : '';
  return text || null;
}

function workRank(task: Task): number {
  if (task.priority === 'blocker') return 0;
  return task.status === 'in_progress' ? 1 : 2;
}

/** Started, and now waiting on something outside (Google, a decision, a meeting). */
function isWaiting(task: Task): boolean {
  return task.status === 'in_progress' && task.tags.includes(WAITING_TAG);
}

/** Released, by the board's rule: done, deployed, and the release is not older than the last Done. */
function releasedAt(task: Task): Date | null {
  if (task.status !== 'done' || !task.deployedAt) return null;
  const deployed = new Date(task.deployedAt);
  if (Number.isNaN(deployed.getTime())) return null;
  if (task.doneAt && deployed < new Date(task.doneAt)) return null;
  return deployed;
}

/**
 * The hand-off state a task is in on this panel, if any. A task in a hand-off
 * state shows only in that section — never as focus, next, waiting or a row,
 * whatever other tags it carries. `check` wins over released, released wins
 * over `checked`. 'checked' = Shlomi checked it and it waits for the team
 * lead's release: it stays in the check section, marked, until released.
 */
type HandOff = 'check' | 'checked' | 'released';
function handOff(task: Task, now: number): HandOff | null {
  if (task.tags.includes(CHECK_TAG)) return 'check';
  const released = releasedAt(task);
  if (released) {
    const fresh = now - released.getTime() <= RELEASED_DAYS * 86_400_000;
    return fresh && !task.tags.includes(OFF_TABLE_TAG) ? 'released' : null;
  }
  if (task.tags.includes(CHECKED_TAG)) return 'checked';
  return null;
}

function formatDay(d: Date): string {
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

/**
 * Who a waiting task waits on, from its `waiting-on:<who>` tag: `us` (parked by
 * our side), `Shlomi` (him — the loudest pill), anyone else (outside, amber).
 * No tag = the plain "בהמתנה". rank orders the waiting section: him, outside, us.
 */
type WaitKind = 'shlomi' | 'outside' | 'us' | 'plain';
function waitingOn(task: Task): { kind: WaitKind; label: string; cls: string; rank: number } {
  const tag = task.tags.find(t => t.toLowerCase().startsWith(WAITING_ON_PREFIX));
  const who = tag ? tag.slice(WAITING_ON_PREFIX.length).trim() : '';
  const key = who.toLowerCase();
  if (!who) return { kind: 'plain', label: 'בהמתנה', cls: styles.pillWaiting, rank: 1 };
  if (key === 'us') return { kind: 'us', label: 'אצלנו – בהמתנה', cls: styles.pillWaitUs, rank: 2 };
  if (key === 'shlomi' || who === 'שלומי') return { kind: 'shlomi', label: 'מחכה לך', cls: styles.pillWaitYou, rank: 0 };
  return { kind: 'outside', label: `מחכה ל${WHO_HE[key] ?? who}`, cls: styles.pillWaiting, rank: 1 };
}

function statusPill(task: Task): { cls: string; text: string } {
  if (task.priority === 'blocker') return { cls: styles.pillBlocker, text: 'Blocker' };
  if (isWaiting(task)) { const w = waitingOn(task); return { cls: w.cls, text: w.label }; }
  if (task.status === 'in_progress') return { cls: styles.pillProgress, text: 'בעבודה' };
  if (task.status === 'done') return { cls: styles.pillTodo, text: 'הושלמה' };
  return { cls: styles.pillTodo, text: 'טרם התחלנו' };
}

/**
 * Focus tasks in display order, connected ones side by side: each group is
 * the focus tasks reachable from each other through links, placed where its
 * first member stood.
 */
function groupLinked(list: Task[], linksOf: (t: Task) => number[]): Task[][] {
  const byId = new Map(list.map(t => [t.id, t]));
  const seen = new Set<number>();
  const groups: Task[][] = [];
  for (const t of list) {
    if (seen.has(t.id)) continue;
    const group: Task[] = [];
    const stack = [t];
    seen.add(t.id);
    while (stack.length) {
      const cur = stack.shift()!;
      group.push(cur);
      for (const id of linksOf(cur)) {
        const other = byId.get(id);
        if (other && !seen.has(id)) { seen.add(id); stack.push(other); }
      }
    }
    groups.push(group.sort((a, b) => list.indexOf(a) - list.indexOf(b)));
  }
  return groups;
}

/**
 * Labelled quote lines under a point:
 *   "החלטה (17.11): text"  → a decision (decided in the meeting)
 *   "המלצה (17.11): text"  → a recommendation (proposed, not yet decided)
 * Returns null for any other quote.
 */
type LabelKind = 'decision' | 'recommendation';
const LABELS: Array<{ word: string; kind: LabelKind }> = [
  { word: 'החלטה', kind: 'decision' },
  { word: 'המלצה', kind: 'recommendation' },
];
function asLabeled(quote: string): { kind: LabelKind; word: string; date: string | null; text: string } | null {
  for (const { word, kind } of LABELS) {
    if (!quote.startsWith(word)) continue;
    const m = quote.slice(word.length).match(/^(?:\s*\(([^)]*)\))?\s*[:：-]?\s*(.*)$/);
    if (!m) continue;
    if (m[1] === undefined && !/^(\s|:|$)/.test(quote.slice(word.length))) continue;
    return { kind, word, date: m[1] ? m[1].trim() : null, text: m[2].trim() };
  }
  return null;
}

function readOpenPrefs(): OpenPrefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null');
    if (parsed && typeof parsed === 'object') return { t: parsed.t || {}, d: parsed.d || {}, c: parsed.c || {} };
  } catch { /* private mode / bad value */ }
  return { t: {}, d: {}, c: {} };
}

function readReleasedOpen(): boolean {
  try { return localStorage.getItem(RELEASED_OPEN_KEY) === '1'; } catch { return false; }
}

function formatClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}.${d.getMonth() + 1} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}


function TopicTitle({ title }: { title: string }) {
  // "… (#984)" — keep the reference, quietly
  const m = title.match(/^(.*?)\s*(\(#\d+\))\s*$/);
  if (!m) return <>{title}</>;
  return (
    <>
      {m[1]} <span className={styles.titleRef}>{m[2]}</span>
    </>
  );
}

/* ── Icons ── (shared ones live in icons.tsx) */
/** "Up next": two chevrons pointing the way the page reads on (left, RTL). */
const NextIcon = ({ filled = false, size = 22 }: { filled?: boolean; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={filled ? 2.4 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="12 6 6 12 12 18" />
    <polyline points="19 6 13 12 19 18" />
  </svg>
);

const LinkIcon = ({ size = 13 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13.5a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
    <path d="M14 10.5a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  </svg>
);

const HourglassIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.5 3h11M6.5 21h11" />
    <path d="M7.5 3c0 4.5 4.5 6 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 6-4.5 9s4.5 4.5 4.5 9" />
  </svg>
);

const STAR_POINTS ='12,2.6 14.75,8.6 21.3,9.3 16.4,13.75 17.8,20.2 12,16.9 6.2,20.2 7.6,13.75 2.7,9.3 9.25,8.6';

const StarIcon = ({ filled = false, size = 28 }: { filled?: boolean; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <polygon points={STAR_POINTS} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5} strokeLinejoin="round" />
  </svg>
);

/** The target ring of a focus card: dial, glowing arc, crosshair, filled star. */
function FocusRing() {
  return (
    <svg className={styles.ring} viewBox="0 0 176 176" aria-hidden="true">
      <defs>
        <radialGradient id="mcRingCore" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="rgba(174,128,255,0.30)" />
          <stop offset="0.6" stopColor="rgba(123,57,197,0.10)" />
          <stop offset="1" stopColor="rgba(123,57,197,0)" />
        </radialGradient>
      </defs>
      {/* crosshair */}
      <line className={styles.ringCross} x1="-14" y1="88" x2="26" y2="88" />
      <line className={styles.ringCross} x1="150" y1="88" x2="190" y2="88" />
      <line className={styles.ringCross} x1="88" y1="-14" x2="88" y2="26" />
      <line className={styles.ringCross} x1="88" y1="150" x2="88" y2="190" />
      <circle cx="88" cy="88" r="50" fill="url(#mcRingCore)" />
      <circle className={styles.ringThin} cx="88" cy="88" r="83" />
      <circle className={styles.ringFaintArc} cx="88" cy="88" r="75" />
      <g className={styles.ringArcWrap}>
        <circle className={styles.ringArc} cx="88" cy="88" r="75" transform="rotate(-92 88 88)" />
      </g>
      <g className={styles.ringDialWrap}>
        <circle className={styles.ringDial} cx="88" cy="88" r="62" />
      </g>
      <circle className={styles.ringThin} cx="88" cy="88" r="54" />
      <polygon className={styles.ringStar} points={STAR_POINTS} transform="translate(60 60) scale(2.333)" />
    </svg>
  );
}

export function ManagementCenter() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openPrefs, setOpenPrefs] = useState<OpenPrefs>(readOpenPrefs);
  const sections = useSectionCollapse();
  const [releasedOpen, setReleasedOpenState] = useState(readReleasedOpen);
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null);
  const [modalTaskId, setModalTaskId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [clock, setClock] = useState(() => formatClock(new Date()));
  const [busyStar, setBusyStar] = useState<Set<number>>(() => new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    getTasks()
      .then(list => { setTasks(list); setLoadError(null); })
      .catch(err => setLoadError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    load();
    // Phones drop the live stream while asleep — re-read when the page comes back.
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const upsert = useCallback((task: Task) => {
    const t = withDates(task);
    setTasks(prev => {
      if (!prev) return prev;
      return prev.some(x => x.id === t.id) ? prev.map(x => (x.id === t.id ? t : x)) : [...prev, t];
    });
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const changeLine = useCallback(async (task: Task, change: { index: number; text: string; checked?: boolean; note?: string }) => {
    const optimistic = applyLineChange(task.description || '', change);
    if (optimistic !== null) {
      setTasks(prev => prev && prev.map(t => (t.id === task.id ? { ...t, description: optimistic } : t)));
    }
    try {
      upsert(await updateAgendaLine(task.id, change));
    } catch (err) {
      showToast(err instanceof Error && err.message ? `לא נשמר: ${err.message}` : 'לא נשמר — נסה שוב');
      getTask(task.id).then(upsert).catch(() => { /* the next load fixes it */ });
    }
  }, [upsert, showToast]);

  /**
   * Every tag change on this panel: optimistic, then applied again on a fresh
   * read so every other tag (and any concurrent edit) stays; on failure the
   * task is re-read from the board (the rollback). One change per task at a
   * time — its buttons are disabled in place meanwhile.
   */
  const retag = useCallback(async (task: Task, change: (tags: string[]) => string[]) => {
    if (busyStar.has(task.id)) return;
    setBusyStar(prev => new Set(prev).add(task.id));
    setTasks(prev => prev && prev.map(t => (t.id === task.id ? { ...t, tags: change(t.tags) } : t)));
    try {
      const fresh = await getTask(task.id);
      const tags = change(fresh.tags);
      const same = tags.length === fresh.tags.length && tags.every(x => fresh.tags.includes(x));
      if (same) { upsert(fresh); return; }
      upsert(await updateTask(task.id, { tags }));
    } catch (err) {
      showToast(err instanceof Error && err.message ? `לא נשמר: ${err.message}` : 'לא נשמר — נסה שוב');
      getTask(task.id).then(upsert).catch(() => { /* the next load fixes it */ });
    } finally {
      setBusyStar(prev => { const next = new Set(prev); next.delete(task.id); return next; });
    }
  }, [busyStar, upsert, showToast]);

  /** Star / next: add or remove only that tag. Marking one removes the other (a task is focus or next). */
  const toggleMark = (task: Task, tag: MarkTag) => {
    const want = !task.tags.includes(tag);
    return retag(task, tags => withMark(tags, tag, want));
  };
  const toggleFocus = (task: Task) => toggleMark(task, FOCUS_TAG);
  const toggleNext = (task: Task) => toggleMark(task, NEXT_TAG);
  /** "נבדק": `check` → `checked`; the team lead releases it from there. */
  const markChecked = (task: Task) =>
    retag(task, tags => [...tags.filter(x => x !== CHECK_TAG && x !== CHECKED_TAG), CHECKED_TAG]);
  /** Undo "נבדק": back to `check`. */
  const unmarkChecked = (task: Task) =>
    retag(task, tags => [...tags.filter(x => x !== CHECK_TAG && x !== CHECKED_TAG), CHECK_TAG]);
  /** "ירד מהשולחן": a released task leaves the panel. */
  const takeOffTable = (task: Task) =>
    retag(task, tags => [...tags.filter(x => x !== OFF_TABLE_TAG), OFF_TABLE_TAG]);

  // ── Ongoing ──
  // Hand-off states first: a task that is ready to check or released shows only
  // in its own section, so every list below drops it (even with focus / next).
  const handOffs = useMemo(() => {
    const map = new Map<number, HandOff>();
    if (!tasks) return map;
    const now = Date.now();
    tasks
      .filter(t => t.type !== 'agenda' && t.type !== 'goal' && !t.isDraft)
      .forEach(t => { const state = handOff(t, now); if (state) map.set(t.id, state); });
    return map;
  }, [tasks]);
  // To check first, then the ones already checked and waiting for release.
  const checkTasks = useMemo(() => (tasks || [])
    .filter(t => { const h = handOffs.get(t.id); return h === 'check' || h === 'checked'; })
    .sort((a, b) => Number(handOffs.get(a.id) === 'checked') - Number(handOffs.get(b.id) === 'checked')
      || (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || b.id - a.id), [tasks, handOffs]);
  const releasedTasks = useMemo(() => (tasks || [])
    .filter(t => handOffs.get(t.id) === 'released')
    .sort((a, b) => (releasedAt(b)?.getTime() ?? 0) - (releasedAt(a)?.getTime() ?? 0) || b.id - a.id), [tasks, handOffs]);
  const working = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => t.type !== 'agenda' && t.type !== 'goal' && !t.isDraft && t.status !== 'done')
      .filter(t => !handOffs.has(t.id))
      // Claude's open tasks, any Blocker, and anything the team lead is tracking with a now: line
      .filter(t => t.priority === 'blocker' || t.assignee === 'Claude' || nowStatus(t) !== null)
      .sort((a, b) =>
        workRank(a) - workRank(b) ||
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
        b.id - a.id);
  }, [tasks, handOffs]);
  // Connections, read both ways (a link written on either task counts for both).
  const linkMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    const add = (a: number, b: number) => {
      if (a === b) return;
      if (!map.has(a)) map.set(a, new Set());
      map.get(a)!.add(b);
    };
    (tasks || []).forEach(t => (t.linkedTasks || []).forEach(id => {
      if (typeof id !== 'number') return;
      add(t.id, id);
      add(id, t.id);
    }));
    return map;
  }, [tasks]);
  const linksOf = useCallback((t: Task) => [...(linkMap.get(t.id) || [])].sort((a, b) => a - b), [linkMap]);
  // Focus: the full cards first, the compact waiting ones after them.
  const focusTasks = working
    .filter(t => t.tags.includes(FOCUS_TAG))
    .sort((a, b) => Number(isWaiting(a)) - Number(isWaiting(b)));
  const focusGroups = groupLinked(focusTasks, linksOf);
  // Next: any open task marked `next` (it is often not being worked on yet), in priority order.
  const nextTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => t.type !== 'agenda' && t.type !== 'goal' && !t.isDraft && t.status !== 'done')
      .filter(t => t.tags.includes(NEXT_TAG) && !t.tags.includes(FOCUS_TAG) && !handOffs.has(t.id))
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || b.id - a.id);
  }, [tasks, handOffs]);
  const unmarked = working.filter(t => !t.tags.includes(FOCUS_TAG) && !t.tags.includes(NEXT_TAG));
  // Waiting on him first, then on someone outside (or unsaid), then parked by us.
  const waitingTasks = unmarked.filter(isWaiting).sort((a, b) => waitingOn(a).rank - waitingOn(b).rank);
  const otherTasks = unmarked.filter(t => !isWaiting(t));

  // ── Agenda — one topic at a time, in board order (finished topics stay in place) ──
  const topics = useMemo(() => topicsTagged(tasks, AGENDA_PREFIX), [tasks]);
  // Action items from a meeting: same shape, their own tag, their own panel.
  const actions = useMemo(() => topicsTagged(tasks, ACTIONS_PREFIX), [tasks]);
  const isAction = isActionTopic;

  // Comments on the action items: one more level under each line (useActionComments.tsx).
  const comments = useActionComments(actions.map(a => a.task.id), { onTask: upsert, onError: showToast });

  useBoardStream(true, event => {
    if (event.type === 'task_created' || event.type === 'task_updated') upsert(event.task);
    comments.onBoardEvent(event);
  });

  const modalTask = modalTaskId !== null ? tasks?.find(t => t.id === modalTaskId) ?? null : null;

  // Esc closes the task modal.
  useEffect(() => {
    if (modalTaskId === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalTaskId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalTaskId]);

  // Open / closed: topics default open, a subtopic's details default closed.
  const topicOpen = (t: Topic) => openPrefs.t[t.task.id] ?? true;
  const subKey = (t: Topic, line: LineBlock) => `${t.task.id}:${line.index}`;
  const subOpen = (t: Topic, line: LineBlock) => openPrefs.d[subKey(t, line)] ?? false;
  // An action line's note is not a detail: it shows in the line's comment thread, signed.
  const hasDetails = (t: Topic, line: LineBlock) =>
    line.details.length > 0 || line.quotes.length > 0 || (!!line.note && !isAction(t));
  // Comment threads (action items) start open; the bubble closes / reopens one, remembered.
  const threadKey = (t: Topic, line: LineBlock) => `${t.task.id}:${line.key ?? `#${line.index}`}`;
  const threadOpen = (t: Topic, line: LineBlock) => openPrefs.c[threadKey(t, line)] ?? true;

  const savePrefs = useCallback((next: OpenPrefs) => {
    setOpenPrefs(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, []);

  const setTopicOpen = (t: Topic, open: boolean) =>
    savePrefs({ ...openPrefs, t: { ...openPrefs.t, [t.task.id]: open } });
  const setSubOpen = (t: Topic, line: LineBlock, open: boolean) =>
    savePrefs({ ...openPrefs, d: { ...openPrefs.d, [subKey(t, line)]: open } });
  const setThreadOpen = (t: Topic, line: LineBlock, open: boolean) =>
    savePrefs({ ...openPrefs, c: { ...openPrefs.c, [threadKey(t, line)]: open } });

  const allOpen = topics.length > 0 && topics.every(t =>
    topicOpen(t) && t.blocks.every(b => b.kind !== 'line' || !hasDetails(t, b) || subOpen(t, b)));
  const setAll = (open: boolean) => {
    const next: OpenPrefs = { t: { ...openPrefs.t }, d: { ...openPrefs.d }, c: { ...openPrefs.c } };
    topics.forEach(t => {
      next.t[t.task.id] = open;
      t.blocks.forEach(b => { if (b.kind === 'line' && hasDetails(t, b)) next.d[subKey(t, b)] = open; });
    });
    savePrefs(next);
  };

  const tickLine = (t: Topic, line: LineBlock) => {
    void changeLine(t.task, { index: line.index, text: line.text, checked: !line.checked });
  };

  const openNote = (task: Task, line: LineBlock) => {
    setNoteDraft({ taskId: task.id, index: line.index, text: line.text, value: line.note || '', hadNote: !!line.note });
  };

  const openTask = (t: Task) => setModalTaskId(t.id);

  const saveNote = () => {
    if (!noteDraft) return;
    const task = tasks?.find(t => t.id === noteDraft.taskId);
    const value = noteDraft.value.trim();
    setNoteDraft(null);
    if (!task || (!value && !noteDraft.hadNote)) return;
    void changeLine(task, { index: noteDraft.index, text: noteDraft.text, note: value });
  };

  const removeNote = () => {
    if (!noteDraft) return;
    const task = tasks?.find(t => t.id === noteDraft.taskId);
    setNoteDraft(null);
    if (task) void changeLine(task, { index: noteDraft.index, text: noteDraft.text, note: '' });
  };

  /**
   * Level 2 — a subtopic (a `- [ ]` line) with its level-3 details and, on an
   * action item, its comment thread (`threads`). Rows under a line keep the
   * line's direction; only each detail's own text picks its direction.
   */
  const renderSub = (t: Topic, line: LineBlock, threads?: TopicThreads) => {
    const expandable = hasDetails(t, line);
    const open = expandable && subOpen(t, line);
    const action = isAction(t);
    const thread = threads?.byIndex.get(line.index) ?? [];
    const count = thread.length;
    const tOpen = count > 0 && threadOpen(t, line);
    const lineDir = textDir(line.text);
    const iso = (text: string, rich = true) => (
      <span className={styles.iso} dir={textDir(text)}>{rich ? <RichText text={text} /> : <Linkify text={text} />}</span>
    );
    const commentLabel = count === 0 ? 'הוספת תגובה' : tOpen ? 'הסתרת התגובות' : 'הצגת התגובות';
    return (
      <li key={`l${line.index}`} className={`${styles.sub} ${line.checked ? styles.subDone : ''}`}>
        <div className={styles.subRow}>
          {expandable ? (
            <button
              type="button"
              className={styles.chev}
              aria-expanded={open}
              aria-label={open ? 'הסתרת הפרטים' : 'הצגת הפרטים'}
              onClick={() => setSubOpen(t, line, !open)}
            >
              <ChevronIcon dir={open ? 'down' : 'left'} size={16} />
            </button>
          ) : <span className={styles.chevSlot} />}
          <button
            type="button"
            role="checkbox"
            aria-checked={line.checked}
            aria-label={line.checked ? 'בטל סימון' : isAction(t) ? 'סמן כבוצע' : 'סמן כנדון'}
            className={styles.check}
            onClick={() => tickLine(t, line)}
          >
            <span className={styles.box}>{line.checked && <CheckIcon size={13} />}</span>
          </button>
          <span
            className={`${styles.subText} ${expandable ? styles.subTextClickable : ''}`}
            dir={textDir(line.text)}
            onClick={expandable ? () => setSubOpen(t, line, !open) : undefined}
          >
            <RichText text={line.text} />
          </span>
          {action ? (
            // Fixed width whether it shows a count or a plus — nothing moves when the first comment lands.
            <button
              type="button"
              className={`${styles.commentBtn} ${count ? styles.commentBtnHas : ''} ${tOpen ? styles.commentBtnOpen : ''}`}
              aria-label={commentLabel}
              aria-expanded={count ? tOpen : undefined}
              title={commentLabel}
              onClick={() => (count ? setThreadOpen(t, line, !tOpen) : comments.startAdd(t, line))}
            >
              <CommentIcon size={16} />
              <span className={styles.commentCount}>{count || '+'}</span>
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.noteBtn} ${line.note ? styles.noteBtnHas : ''}`}
              aria-label={line.note ? 'עריכת הערה' : 'הוספת הערה'}
              title={line.note ? 'עריכת הערה' : 'הוספת הערה'}
              onClick={() => openNote(t.task, line)}
            >
              <PencilIcon />
            </button>
          )}
        </div>
        {open && (
          <ul className={styles.details} dir={lineDir}>
            {line.quotes.map((q, i) => {
              const labeled = asLabeled(q);
              if (labeled) {
                return (
                  <li key={`q${i}`}>
                    <strong className={labeled.kind === 'recommendation' ? styles.recTag : styles.detailTag}>
                      {labeled.word}{labeled.date ? ` (${labeled.date})` : ''}:
                    </strong> {iso(labeled.text)}
                  </li>
                );
              }
              return <li key={`q${i}`}>{iso(q)}</li>;
            })}
            {line.note && !action && (
              <li><strong className={styles.detailTag}>הערה של שלומי:</strong> {iso(line.note, false)}</li>
            )}
            {line.details.map((d, i) => (
              <li key={`d${i}`}>{iso(d)}</li>
            ))}
          </ul>
        )}
        {tOpen && (
          <CommentThread flow={comments} entries={thread} lineText={line.text} line={line} topic={t} />
        )}
      </li>
    );
  };

  /** Level 1 — a topic, with its subtopics (and, on action items, their comment threads). */
  const renderTopic = (t: Topic) => {
    const open = topicOpen(t);
    const threads = isAction(t) ? comments.threadsFor(t) : undefined;
    return (
      <section key={t.task.id} className={`${styles.topic} ${t.done ? styles.topicDone : ''}`}>
        <button type="button" className={styles.topicRow} aria-expanded={open} onClick={() => setTopicOpen(t, !open)}>
          <span className={styles.topicChev}><ChevronIcon dir={open ? 'down' : 'left'} size={18} /></span>
          <span className={styles.topicTitle} dir={textDir(t.task.title)}><TopicTitle title={t.task.title} /></span>
          {t.done && <span className={styles.topicCheck} title={isAction(t) ? 'בוצע' : 'נדון'}><CheckIcon size={12} /></span>}
          <span className={styles.spacer} />
          <span className={styles.topicCount} dir="ltr">{t.ticked}/{t.total}</span>
        </button>
        {open && (
          <ul className={styles.subs}>
            {t.blocks.map((b, i) => {
              if (b.kind === 'line') return renderSub(t, b, threads);
              if (b.kind === 'heading') return <li key={`h${i}`} className={styles.group} dir={textDir(b.text)}>{b.text}</li>;
              return <li key={`t${i}`} className={styles.smallText} dir={textDir(b.text)}><RichText text={b.text} /></li>;
            })}
          </ul>
        )}
        {open && threads && <OrphanThreads flow={comments} topic={t} orphans={threads.orphans} />}
      </section>
    );
  };

  /**
   * Action items — one standing list (Shlomi, 2026-11-24): the items show
   * directly, no topic row to open. A `**section**` line inside the list is a
   * collapsible section row (e.g. "הכנת אבטחה", ActionSections.tsx); items
   * before any section stand alone at the top.
   */
  const renderActionList = (t: Topic) => {
    const threads = comments.threadsFor(t);
    return (
      <section key={t.task.id} className={styles.actionList}>
        <ActionSections
          topic={t}
          threads={threads}
          collapse={sections}
          listClass={`${styles.subs} ${styles.actionSubs}`}
          renderItem={(b, i) => (b.kind === 'line'
            ? renderSub(t, b, threads)
            : <li key={`t${i}`} className={styles.smallText} dir={textDir(b.text)}><RichText text={b.text} /></li>)}
        />
        <OrphanThreads flow={comments} topic={t} orphans={threads.orphans} />
      </section>
    );
  };

  /** "מחובר ל־#986" chips: open the connected task (read-only; links are edited on the board). */
  const renderLinks = (t: Task, compact = false) => {
    const ids = linksOf(t);
    if (ids.length === 0) return null;
    const shown = ids.slice(0, MAX_LINK_CHIPS);
    const rest = ids.length - shown.length;
    return (
      <span className={`${styles.linkChips} ${compact ? styles.linkChipsCompact : ''}`} dir="rtl">
        {shown.map((id, i) => {
          const other = tasks?.find(x => x.id === id);
          const label = compact || i > 0 ? `#${id}` : `מחובר ל־#${id}`;
          const title = other ? `מחובר ל־#${id}: ${other.title}` : `מחובר ל־#${id}`;
          return other ? (
            <button key={id} type="button" className={styles.linkChip} title={title} onClick={() => openTask(other)}>
              <LinkIcon /> <span dir="rtl">{label}</span>
            </button>
          ) : (
            <Link key={id} to={`/tasks/${id}`} className={styles.linkChip} title={title}>
              <LinkIcon /> <span dir="rtl">{label}</span>
            </Link>
          );
        })}
        {rest > 0 && <span className={styles.linkMore} title={ids.slice(MAX_LINK_CHIPS).map(id => `#${id}`).join(' ')}>+{rest}</span>}
      </span>
    );
  };

  /**
   * Waiting: started, now held by something outside. A slim row — lighter
   * than a focus card even when it is in focus — whose now: line says what
   * it waits for.
   */
  const renderWaiting = (t: Task) => {
    const now = nowStatus(t);
    const inFocus = t.tags.includes(FOCUS_TAG);
    const wait = waitingOn(t);
    return (
      <div key={t.id} className={`${styles.waitRow} ${wait.kind === 'shlomi' ? styles.waitRowYou : ''} ${inFocus ? styles.waitRowFocus : ''}`} dir="ltr">
        <button
          type="button"
          className={`${styles.starBtn} ${styles.starBtnSmall} ${inFocus ? styles.starBtnOn : ''}`}
          aria-label={inFocus ? 'הסרה מהפוקוס' : 'לשים בפוקוס'}
          title={inFocus ? 'הסרה מהפוקוס' : 'לשים בפוקוס'}
          aria-pressed={inFocus}
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleFocus(t)}
        >
          <StarIcon filled={inFocus} size={20} />
        </button>
        <button
          type="button"
          className={styles.nextBtn}
          aria-label="לסמן כבא בתור"
          title="לסמן כבא בתור"
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleNext(t)}
        >
          <NextIcon size={20} />
        </button>
        <div className={styles.waitLink} title={now ? `${t.title}\n${wait.label}: ${now}` : `${t.title}\n${wait.label}`} {...openProps(() => openTask(t))}>
          <span className={`${styles.pill} ${styles.pillSmall} ${wait.cls} ${styles.waitPill}`}>
            <HourglassIcon size={13} /> <span className={styles.waitPillText} dir="rtl">{wait.label}</span>
          </span>
          <span className={styles.nextText}>
            <span className={styles.waitTitle} dir={textDir(t.title)}>{t.title}</span>
            <span className={styles.waitFor} dir={textDir(now || 'מחכה')}>{now ? <Linkify text={now} /> : 'מחכה — לא נכתב למה'}</span>
          </span>
          <span className={styles.nextId}>#{t.id}</span>
        </div>
        {renderLinks(t, true)}
      </div>
    );
  };

  /**
   * A hand-off row (ready to check / released): slimmer than a focus card, one
   * button that takes the task off the panel. The button keeps its width and
   * is disabled in place while the change saves.
   */
  const renderHandOff = (t: Task, kind: 'check' | 'released') => {
    const busy = busyStar.has(t.id);
    const now = nowStatus(t);
    const checked = kind === 'check' && t.tags.includes(CHECKED_TAG) && !t.tags.includes(CHECK_TAG);
    const released = kind === 'released' ? releasedAt(t) : null;
    const rowCls = kind === 'released' ? styles.handRowReleased : checked ? styles.handRowChecked : styles.handRowCheck;
    const title = kind === 'check' && !checked && now ? `${t.title}\nלבדוק: ${now}` : t.title;
    return (
      <div key={t.id} className={`${styles.handRow} ${rowCls}`} dir="ltr">
        {checked ? (
          // Same slot and width as the "נבדק" button: the mark itself is the undo.
          <button
            type="button"
            className={`${styles.handBtn} ${styles.handBtnCheck} ${styles.handBtnDone}`}
            title="נבדק — ממתין לשחרור. לחיצה מבטלת ומחזירה לבדיקה"
            aria-label="נבדק — לבטל ולהחזיר לבדיקה"
            disabled={busy}
            onClick={() => void unmarkChecked(t)}
            dir="rtl"
          >
            <span className={styles.handDoneMark}><CheckIcon size={13} /> נבדק</span>
            <span className={styles.handUndo}>ביטול</span>
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.handBtn} ${kind === 'check' ? styles.handBtnCheck : ''}`}
            title={kind === 'check' ? 'בדקתי — אפשר לשחרר' : 'להוריד מהלוח שלי'}
            disabled={busy}
            onClick={() => void (kind === 'check' ? markChecked(t) : takeOffTable(t))}
            dir="rtl"
          >
            <span>{kind === 'check' ? 'לסמן נבדק' : 'ירד מהשולחן'}</span>
          </button>
        )}
        <div className={styles.waitLink} title={title} {...openProps(() => openTask(t))}>
          <span className={styles.nextText}>
            <span className={styles.waitTitle} dir={textDir(t.title)}>{t.title}</span>
            {kind === 'released' && (
              <span className={styles.handSub} dir="rtl">{released ? `שוחרר ב־${formatDay(released)}` : 'שוחרר'}</span>
            )}
            {checked && <span className={styles.handSub} dir="rtl">נבדק – ממתין לשחרור</span>}
            {kind === 'check' && !checked && (
              <span className={styles.handSub} dir={now ? textDir(now) : 'rtl'}>{now ? <Linkify text={now} /> : 'לא נכתב מה לבדוק'}</span>
            )}
          </span>
          <span className={styles.nextId}>#{t.id}</span>
        </div>
        {renderLinks(t, true)}
      </div>
    );
  };

  /** A section head in the panel's quieter style (NEXT / WAITING), with a count. */
  const setReleasedOpen = (open: boolean) => {
    setReleasedOpenState(open);
    try {
      if (open) localStorage.setItem(RELEASED_OPEN_KEY, '1');
      else localStorage.removeItem(RELEASED_OPEN_KEY);
    } catch { /* private mode */ }
  };

  /** A section's head; with `toggle` it is a row that opens / closes the section (chevron at the end, same height). */
  const renderSectionHead = (
    label: string, title: string, count: number, tone?: string,
    toggle?: { open: boolean; onToggle: () => void },
  ) => {
    const inner = (
      <>
        <span className={`${styles.nextLabel} ${tone || ''}`}>{label}</span>
        <span className={styles.nextHeadTitle} dir="rtl">{title}</span>
        <span className={styles.sectionCount}>{count}</span>
        <span className={styles.nextRule} />
        {toggle && <span className={styles.nextHeadChev}><ChevronIcon dir={toggle.open ? 'down' : 'left'} size={16} /></span>}
      </>
    );
    if (!toggle) return <div className={styles.nextHead} dir="ltr">{inner}</div>;
    return (
      <button
        type="button"
        className={`${styles.nextHead} ${styles.nextHeadToggle}`}
        dir="ltr"
        aria-expanded={toggle.open}
        title={toggle.open ? 'הסתרה' : 'הצגה'}
        onClick={toggle.onToggle}
      >
        {inner}
      </button>
    );
  };

  const renderFocus = (t: Task) => {
    if (isWaiting(t)) return renderWaiting(t);
    const now = nowStatus(t);
    const pill = statusPill(t);
    return (
      <div key={t.id} className={styles.focusCard} dir="ltr">
        <span className={`${styles.bracket} ${styles.bTL}`} />
        <span className={`${styles.bracket} ${styles.bBL}`} />
        <span className={`${styles.bracket} ${styles.bBR}`} />
        <span className={`${styles.bracket} ${styles.bTR}`} />
        <button
          type="button"
          className={styles.ringBtn}
          aria-label="הסרה מהפוקוס"
          title="הסרה מהפוקוס"
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleFocus(t)}
        >
          <FocusRing />
        </button>
        <div className={styles.focusMain}>
          <div className={styles.focusMeta}>
            <button type="button" className={styles.focusMetaOpen} onClick={() => openTask(t)} tabIndex={-1}>
              <span className={`${styles.pill} ${styles.pillSquare} ${pill.cls}`}>{pill.text}</span>
              <span className={styles.vsep} />
              <span className={styles.focusId}>#{t.id}</span>
            </button>
            {renderLinks(t)}
          </div>
          <div className={styles.focusBody} {...openProps(() => openTask(t))}>
            <span className={styles.focusTitle} dir={textDir(t.title)} title={t.title}>{t.title}</span>
            <span className={styles.focusRule} />
            {now && (
              <span className={styles.focusNow} dir="rtl" title={now}>
                <strong>עכשיו:</strong> <Linkify text={now} />
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className={`${styles.nextBtn} ${styles.focusNextBtn}`}
          aria-label="להעביר לבא בתור"
          title="להעביר לבא בתור"
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleNext(t)}
        >
          <NextIcon size={20} />
        </button>
      </div>
    );
  };

  /** Up next: quieter than focus. A slim card, smaller type, no ring. */
  const renderNext = (t: Task) => {
    const pill = statusPill(t);
    const now = nowStatus(t);
    return (
      <div key={t.id} className={styles.nextCard} dir="ltr">
        <button
          type="button"
          className={`${styles.nextBtn} ${styles.nextBtnOn}`}
          aria-label="הסרה מהבא בתור"
          title="הסרה מהבא בתור"
          aria-pressed="true"
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleNext(t)}
        >
          <NextIcon filled size={20} />
        </button>
        <div className={styles.nextLink} title={now ? `${t.title}\nעכשיו: ${now}` : t.title} {...openProps(() => openTask(t))}>
          <span className={`${styles.pill} ${styles.pillSmall} ${pill.cls}`}>{pill.text}</span>
          <span className={styles.nextText}>
            <span className={styles.nextTitle} dir={textDir(t.title)}>{t.title}</span>
            {now && <span className={styles.taskNow} dir={textDir(now)}><Linkify text={now} /></span>}
          </span>
          <span className={styles.nextId}>#{t.id}</span>
        </div>
        {renderLinks(t, true)}
        <button
          type="button"
          className={`${styles.starBtn} ${styles.starBtnSmall}`}
          aria-label="לשים בפוקוס"
          title="לשים בפוקוס"
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleFocus(t)}
        >
          <StarIcon size={20} />
        </button>
      </div>
    );
  };

  const renderRow = (t: Task) => {
    const pill = statusPill(t);
    const now = nowStatus(t);
    return (
      <div key={t.id} className={styles.taskRow} dir="ltr">
        <button
          type="button"
          className={styles.starBtn}
          aria-label="לשים בפוקוס"
          title="לשים בפוקוס"
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleFocus(t)}
        >
          <StarIcon />
        </button>
        <button
          type="button"
          className={styles.nextBtn}
          aria-label="לסמן כבא בתור"
          title="לסמן כבא בתור"
          disabled={busyStar.has(t.id)}
          onClick={() => void toggleNext(t)}
        >
          <NextIcon />
        </button>
        <div className={styles.taskLink} title={now ? `${t.title}\nעכשיו: ${now}` : t.title} {...openProps(() => openTask(t))}>
          <span className={`${styles.pill} ${pill.cls}`}>{pill.text}</span>
          <span className={styles.taskText}>
            <span className={styles.taskTitle} dir={textDir(t.title)}>{t.title}</span>
            {now && <span className={styles.taskNow} dir={textDir(now)}><Linkify text={now} /></span>}
          </span>
          <span className={styles.vsep} />
          <span className={styles.taskId}>#{t.id}</span>
        </div>
        {renderLinks(t, true)}
      </div>
    );
  };

  return (
    <div className={styles.page} dir="rtl">
      <div className={styles.bg} aria-hidden="true">
        <Threads />
      </div>
      <span className={`${styles.corner} ${styles.cTL}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cTR}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cBL}`} aria-hidden="true" />
      <span className={`${styles.corner} ${styles.cBR}`} aria-hidden="true" />

      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Link to="/tasks" className={styles.logoLink} title="ללוח המשימות">
            <img className={styles.logo} src={LOGO_SRC} alt="Lybi" />
          </Link>
          <span className={`${styles.vsep} ${styles.vsepTall}`} />
          <h1 className={styles.title}>מרכז הניהול של שלומי</h1>
        </div>
        <div className={styles.status}>
          <span className={styles.clock} dir="ltr">{clock}</span>
        </div>
      </header>
      <div className={`${styles.hud} ${styles.hudTop}`} aria-hidden="true" />

      <main className={styles.grid}>
        <div className={styles.rightCol}>
        {/* ── THE AGENDA (right): topics → subtopics → details, one collapsible list ── */}
        <section className={`${styles.panel} ${styles.agendaPanel}`} aria-label="אג'נדה לפגישה הבאה">
          <div className={styles.panelHead} dir="ltr">
            <span className={styles.label}>THE AGENDA</span>
            <span className={styles.rule} />
            {topics.length > 0 && (
              <button type="button" className={styles.allToggle} onClick={() => setAll(!allOpen)} dir="rtl">
                {allOpen ? 'סגור הכל' : 'פתח הכל'}
              </button>
            )}
            <span className={styles.marks}>///</span>
          </div>

          <div className={styles.scroll}>
            <div className={`${styles.scrollInner} ${styles.listInner}`} dir="rtl">
              {loadError && !tasks && (
                <div className={styles.empty}>
                  לא הצלחתי לטעון את הלוח.{' '}
                  <button type="button" className={styles.linkBtn} onClick={load}>נסה שוב</button>
                </div>
              )}
              {!tasks && !loadError && (
                <div className={styles.skeleton} aria-label="טוען">
                  <div className={styles.skeletonBar} />
                  <div className={styles.skeletonBar} />
                  <div className={styles.skeletonBar} />
                </div>
              )}
              {tasks && topics.length === 0 && <div className={styles.empty}>אין נושאים לפגישה הבאה.</div>}
              {topics.map(renderTopic)}
            </div>
          </div>
        </section>

        {/* ── ACTION ITEMS (right, under the agenda): what came out of the meeting ── */}
        {actions.length > 0 && (
          <section className={`${styles.panel} ${styles.actionsPanel}`} aria-label="משימות מהפגישה">
            <div className={styles.panelHead} dir="ltr">
              <span className={`${styles.label} ${styles.labelActions}`}>ACTION ITEMS</span>
              <span className={styles.rule} />
              <span className={styles.actionsCount} dir="rtl">
                {actions.reduce((n, a) => n + a.total - a.ticked, 0)} פתוחות
              </span>
              <SectionsToggle topics={actions.filter(a => !a.done)} collapse={sections} />
              <Link
                to={ACTIONS_PAGE}
                target="_blank"
                rel="noopener"
                className={styles.shareLink}
                title="עמוד התגובות — לשליחה לנועה ולהילה"
                dir="rtl"
              >
                <ShareIcon /> <span>עמוד לשיתוף</span>
              </Link>
              <span className={styles.marks}>///</span>
            </div>
            <div className={styles.scroll}>
              <div className={`${styles.scrollInner} ${styles.listInner}`} dir="rtl">
                {actions.filter(a => !a.done).map(renderActionList)}
              </div>
            </div>
          </section>
        )}
        </div>

        {/* ── ONGOING (left) ── */}
        <section className={`${styles.panel} ${styles.ongoingPanel}`} aria-label="בעבודה עכשיו">
          <div className={`${styles.panelHead} ${styles.panelHeadTall}`} dir="ltr">
            <span className={styles.label}>ONGOING</span>
            <h2 className={styles.panelTitle} dir="rtl">בעבודה עכשיו</h2>
            <span className={styles.spacer} />
            <span className={styles.marks}>///</span>
          </div>
          <div className={styles.scroll}>
            <div className={`${styles.scrollInner} ${styles.ongoingInner}`} dir="rtl">
              {!tasks && !loadError && (
                <div className={styles.skeleton} aria-label="טוען">
                  <div className={styles.skeletonBar} />
                  <div className={styles.skeletonBar} />
                </div>
              )}
              {tasks && checkTasks.length > 0 && (
                <div className={`${styles.nextArea} ${styles.handAreaTop}`}>
                  {renderSectionHead('CHECK', 'מוכן לבדיקה שלך', checkTasks.length, styles.checkLabel)}
                  <div className={styles.nextList}>{checkTasks.map(t => renderHandOff(t, 'check'))}</div>
                </div>
              )}
              {tasks && working.length === 0 && nextTasks.length === 0 && checkTasks.length === 0 && releasedTasks.length === 0 && (
                <div className={styles.empty}>אין משימות בטיפול כרגע.</div>
              )}
              {tasks && (working.length > 0 || nextTasks.length > 0) && (
                <>
                  {focusTasks.length > 0
                    ? (
                      <div className={styles.focusList}>
                        {focusGroups.map(group => (group.length > 1
                          ? (
                            <div key={`g${group[0].id}`} className={styles.linkGroup} aria-label={`משימות מחוברות: ${group.map(t => `#${t.id}`).join(', ')}`}>
                              <span className={styles.linkGroupRail} aria-hidden="true"><LinkIcon size={12} /></span>
                              {group.map(renderFocus)}
                            </div>
                          )
                          : renderFocus(group[0])))}
                      </div>
                    )
                    : (
                      <div className={styles.focusHint}>
                        <StarIcon size={20} />
                        <span>סמנו משימה בכוכב כדי לשים אותה בפוקוס</span>
                      </div>
                    )}
                  {nextTasks.length > 0 && (
                    <div className={styles.nextArea}>
                      <div className={styles.nextHead} dir="ltr">
                        <span className={styles.nextLabel}>NEXT</span>
                        <span className={styles.nextHeadTitle} dir="rtl">הבא בתור</span>
                        <span className={styles.nextRule} />
                      </div>
                      <div className={styles.nextList}>{nextTasks.map(renderNext)}</div>
                    </div>
                  )}
                  {waitingTasks.length > 0 && (
                    <div className={styles.nextArea}>
                      <div className={styles.nextHead} dir="ltr">
                        <span className={`${styles.nextLabel} ${styles.waitLabel}`}>WAITING</span>
                        <span className={styles.nextHeadTitle} dir="rtl">בהמתנה</span>
                        <span className={`${styles.nextRule} ${styles.waitRule}`} />
                      </div>
                      <div className={styles.nextList}>{waitingTasks.map(renderWaiting)}</div>
                    </div>
                  )}
                  {otherTasks.length > 0 && <div className={styles.taskList}>{otherTasks.map(renderRow)}</div>}
                </>
              )}
              {tasks && releasedTasks.length > 0 && (
                <div className={`${styles.nextArea} ${styles.handAreaBottom}`}>
                  {renderSectionHead('RELEASED', 'שוחרר', releasedTasks.length, styles.releasedLabel,
                    { open: releasedOpen, onToggle: () => setReleasedOpen(!releasedOpen) })}
                  {releasedOpen && <div className={styles.nextList}>{releasedTasks.map(t => renderHandOff(t, 'released'))}</div>}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer} aria-hidden="true">
        <div className={styles.hud} />
        <div className={styles.ruler} />
      </footer>

      {modalTask && (() => {
        const pill = statusPill(modalTask);
        const now = nowStatus(modalTask);
        const modalLinks = linksOf(modalTask).map(id => ({ id, task: tasks?.find(x => x.id === id) }));
        return (
          <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) setModalTaskId(null); }}>
            <div className={`${styles.modal} ${styles.taskModal}`} role="dialog" aria-modal="true" aria-label={`#${modalTask.id} ${modalTask.title}`}>
              <div className={styles.modalHead} dir="ltr">
                <span className={styles.label}>TASK</span>
                <span className={styles.focusId}>#{modalTask.id}</span>
                <span className={`${styles.pill} ${pill.cls}`}>{pill.text}</span>
                <span className={styles.modalPriority}>{PRIORITY_LABEL[modalTask.priority] ?? modalTask.priority}</span>
                <span className={styles.spacer} />
                <button type="button" className={styles.closeBtn} aria-label="סגירה" title="סגירה (Esc)" onClick={() => setModalTaskId(null)} autoFocus>
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.taskModalTitle} dir={textDir(modalTask.title)}>{modalTask.title}</div>
              {now && (
                <div className={styles.taskModalNow} dir="rtl"><strong>{isWaiting(modalTask) ? 'מחכה:' : 'עכשיו:'}</strong> <Linkify text={now} /></div>
              )}
              {modalLinks.length > 0 && (
                <div className={styles.modalLinks} dir="rtl">
                  <span className={styles.modalLinksLabel}><LinkIcon size={14} /> מחובר ל:</span>
                  <div className={styles.modalLinksList}>
                    {modalLinks.map(({ id, task: other }) => {
                      if (!other) {
                        return (
                          <Link key={id} to={`/tasks/${id}`} className={styles.modalLink}>
                            <span className={styles.modalLinkId}>#{id}</span>
                          </Link>
                        );
                      }
                      const p = statusPill(other);
                      return (
                        <button key={id} type="button" className={styles.modalLink} onClick={() => openTask(other)}>
                          <span className={styles.modalLinkId}>#{id}</span>
                          <span className={styles.modalLinkTitle} dir={textDir(other.title)}>{other.title}</span>
                          <span className={`${styles.pill} ${styles.pillSmall} ${p.cls}`}>{p.text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className={styles.taskModalRule} />
              <div className={styles.taskModalBody}>
                {modalTask.description?.trim()
                  ? <TaskMarkdown text={modalTask.description} />
                  : <p className={styles.mdP} dir="rtl">אין תיאור.</p>}
              </div>
              <div className={styles.taskModalFoot}>
                <Link to={`/tasks/${modalTask.id}`} className={styles.boardLink}>
                  פתח בלוח <ChevronIcon dir="left" size={16} />
                </Link>
              </div>
            </div>
          </div>
        );
      })()}

      {noteDraft && (
        <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) setNoteDraft(null); }}>
          <div className={styles.modal} role="dialog" aria-label="הערה">
            <div className={styles.modalHead} dir="ltr">
              <span className={styles.label}>NOTE</span>
              <span className={styles.modalTitle} dir="rtl">הערה</span>
              <span className={styles.spacer} />
              <span className={styles.marks}>///</span>
            </div>
            <div className={styles.modalLine} dir={textDir(noteDraft.text)}><RichText text={noteDraft.text} /></div>
            <textarea
              className={styles.modalInput}
              autoFocus
              rows={3}
              placeholder="הערה קצרה…"
              value={noteDraft.value}
              onChange={e => setNoteDraft({ ...noteDraft, value: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Escape') setNoteDraft(null);
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); }
              }}
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.primaryBtn} onClick={saveNote}>שמירה</button>
              <button type="button" className={styles.ghostBtn} onClick={() => setNoteDraft(null)}>ביטול</button>
              {noteDraft.hadNote && (
                <button type="button" className={styles.dangerBtn} onClick={removeNote}>מחיקת ההערה</button>
              )}
            </div>
          </div>
        </div>
      )}

      {comments.modals}

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  );
}
