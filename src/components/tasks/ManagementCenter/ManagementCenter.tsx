import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../../types/task';
import { getTask, getTasks, updateAgendaLine, updateTask } from '../../../services/taskService';
import { useBoardStream } from '../../../hooks/useBoardStream';
import { applyLineChange, parseAgenda, splitBold } from './agendaParse';
import type { AgendaBlock } from './agendaParse';
import { TaskMarkdown } from './TaskMarkdown';
import { textDir } from './textDir';
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
 *  • ONGOING (left) — open tasks Claude is on, any Blocker, and any open task
 *    with a now: tag. Tasks tagged `focus` lead as hero cards; the star on any
 *    task adds / removes only that tag. Right after them, quieter, come the
 *    tasks tagged `next` (any open task: what Shlomi takes after the focus);
 *    the "next" mark beside the star adds / removes that tag. A task is focus
 *    or next, never both. Clicking a task opens a read-only modal.
 *    A started task that is now waiting on something (status in_progress +
 *    tag `waiting`) gets its own label and a compact row whose now: line says
 *    what it waits for — also when it is in focus. Connected tasks (the
 *    board's `linkedTasks`, read both ways) show a chip that opens the other
 *    task, and connected focus tasks are drawn as one group. Links are
 *    read-only here.
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
const MAX_LINK_CHIPS = 2;
const OPEN_KEY = 'lybi-center-agenda-open';

type LineBlock = Extract<AgendaBlock, { kind: 'line' }>;
type NoteDraft = { taskId: number; index: number; text: string; value: string; hadNote: boolean };
type Topic = { task: Task; blocks: AgendaBlock[]; total: number; ticked: number; done: boolean };
/** Open / closed overrides: t = topic id → open, d = "<topicId>:<line index>" → details open. */
type OpenPrefs = { t: Record<string, boolean>; d: Record<string, boolean> };

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

function statusPill(task: Task): { cls: string; text: string } {
  if (task.priority === 'blocker') return { cls: styles.pillBlocker, text: 'Blocker' };
  if (isWaiting(task)) return { cls: styles.pillWaiting, text: 'בהמתנה' };
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
    if (parsed && typeof parsed === 'object') return { t: parsed.t || {}, d: parsed.d || {} };
  } catch { /* private mode / bad value */ }
  return { t: {}, d: {} };
}

function formatClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()}.${d.getMonth() + 1} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Bold({ text }: { text: string }) {
  return (
    <>
      {splitBold(text).map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <span key={i}>{p.text}</span>))}
    </>
  );
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

/* ── Icons ── (RTL: "next" points left, "previous" right; collapsed ‹, open ⌄) */
const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronIcon = ({ dir, size = 20 }: { dir: 'left' | 'right' | 'down'; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === 'down' && <polyline points="6 9 12 15 18 9" />}
    {dir === 'left' && <polyline points="15 6 9 12 15 18" />}
    {dir === 'right' && <polyline points="9 6 15 12 9 18" />}
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
  </svg>
);

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    <line x1="14.5" y1="5.5" x2="18.5" y2="9.5" />
  </svg>
);

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

/**
 * The background light threads, mirrored from the design (flares at the top
 * and bottom of the agenda side). Two layers drift very slowly.
 */
function Threads() {
  const top = [
    'M -60 210 C 180 170, 420 92, 596 62 S 930 -6, 1160 -60',
    'M 210 -60 C 380 10, 500 44, 596 62 S 820 150, 1120 300',
    'M -40 70 C 190 46, 400 74, 596 62 C 720 54, 830 18, 920 -60',
    'M 600 -60 C 760 60, 1060 70, 1600 150',
    'M 420 140 C 500 100, 560 74, 596 62 C 640 46, 700 10, 740 -60',
  ];
  const bottom = [
    'M -60 1010 C 150 994, 330 954, 491 935 S 900 852, 1620 1000',
    'M -40 870 C 180 914, 370 946, 491 935 C 650 920, 770 990, 920 1090',
    'M 180 1090 C 300 1006, 410 958, 491 935 S 630 860, 720 760',
    'M 860 1060 C 1080 962, 1320 936, 1620 972',
    'M -60 640 C 40 760, 120 900, 220 1090',
  ];
  const rays = [[596, 62], [491, 935]].flatMap(([cx, cy]) =>
    [-62, -20, 18, 64, 118, 170, 228].map(a => {
      const r = 70 + ((a + 400) % 50);
      const rad = (a * Math.PI) / 180;
      return `M ${cx} ${cy} L ${cx + Math.cos(rad) * r} ${cy + Math.sin(rad) * r}`;
    }));
  const strand = (d: string, i: number, strong: boolean) => (
    <g key={i}>
      <path d={d} className={styles.threadGlow} style={{ opacity: strong ? 0.16 : 0.07 } as CSSProperties} />
      <path d={d} className={styles.threadCore} style={{ opacity: strong ? 0.42 : 0.17 } as CSSProperties} />
    </g>
  );
  return (
    <svg className={styles.threads} viewBox="0 0 1536 1024" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="mcFlare" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.1" stopColor="#f1e6ff" stopOpacity="0.6" />
          <stop offset="0.28" stopColor="#ae80ff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#7b39c5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mcHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#9e50ef" stopOpacity="0.13" />
          <stop offset="1" stopColor="#7b39c5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mcRay" x1="0" x2="1">
          <stop offset="0" stopColor="#d8beff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#d8beff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="596" cy="62" r="260" fill="url(#mcHalo)" />
      <circle cx="491" cy="935" r="260" fill="url(#mcHalo)" />
      <g className={styles.driftA}>{top.map((d, i) => strand(d, i, i < 2))}</g>
      <g className={styles.driftB}>{bottom.map((d, i) => strand(d, i, i < 2))}</g>
      <g className={styles.rays}>{rays.map((d, i) => <path key={i} d={d} />)}</g>
      <circle className={styles.flare} cx="596" cy="62" r="22" fill="url(#mcFlare)" />
      <circle className={styles.flare} cx="491" cy="935" r="20" fill="url(#mcFlare)" />
    </svg>
  );
}

export function ManagementCenter() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openPrefs, setOpenPrefs] = useState<OpenPrefs>(readOpenPrefs);
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

  useBoardStream(true, event => {
    if (event.type === 'task_created' || event.type === 'task_updated') upsert(event.task);
  });

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
   * Star / next: add or remove only that tag, on a fresh read, keeping every
   * other tag. Marking one removes the other (a task is focus or next).
   */
  const toggleMark = useCallback(async (task: Task, tag: MarkTag) => {
    if (busyStar.has(task.id)) return;
    const want = !task.tags.includes(tag);
    setBusyStar(prev => new Set(prev).add(task.id));
    setTasks(prev => prev && prev.map(t => (t.id === task.id ? { ...t, tags: withMark(t.tags, tag, want) } : t)));
    try {
      const fresh = await getTask(task.id);
      const tags = withMark(fresh.tags, tag, want);
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
  const toggleFocus = (task: Task) => toggleMark(task, FOCUS_TAG);
  const toggleNext = (task: Task) => toggleMark(task, NEXT_TAG);

  // ── Ongoing ──
  const working = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => t.type !== 'agenda' && t.type !== 'goal' && !t.isDraft && t.status !== 'done')
      // Claude's open tasks, any Blocker, and anything the team lead is tracking with a now: line
      .filter(t => t.priority === 'blocker' || t.assignee === 'Claude' || nowStatus(t) !== null)
      .sort((a, b) =>
        workRank(a) - workRank(b) ||
        (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
        b.id - a.id);
  }, [tasks]);
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
      .filter(t => t.tags.includes(NEXT_TAG) && !t.tags.includes(FOCUS_TAG))
      .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || b.id - a.id);
  }, [tasks]);
  const unmarked = working.filter(t => !t.tags.includes(FOCUS_TAG) && !t.tags.includes(NEXT_TAG));
  const waitingTasks = unmarked.filter(isWaiting);
  const otherTasks = unmarked.filter(t => !isWaiting(t));

  // ── Agenda — one topic at a time, in board order (finished topics stay in place) ──
  const topics = useMemo<Topic[]>(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => t.type === 'agenda' && !t.isDraft && !t.tags.includes('agendaMeta') && t.tags.some(tag => tag.startsWith('agendaFor:')))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
      .map(task => {
        const blocks = parseAgenda(task.description);
        const lines = blocks.filter((b): b is LineBlock => b.kind === 'line');
        const ticked = lines.filter(l => l.checked).length;
        const done = task.isCompleted || task.status === 'done' || (lines.length > 0 && ticked === lines.length);
        return { task, blocks, total: lines.length, ticked, done };
      });
  }, [tasks]);

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
  const hasDetails = (line: LineBlock) => line.details.length > 0 || line.quotes.length > 0 || !!line.note;

  const savePrefs = useCallback((next: OpenPrefs) => {
    setOpenPrefs(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, []);

  const setTopicOpen = (t: Topic, open: boolean) =>
    savePrefs({ ...openPrefs, t: { ...openPrefs.t, [t.task.id]: open } });
  const setSubOpen = (t: Topic, line: LineBlock, open: boolean) =>
    savePrefs({ ...openPrefs, d: { ...openPrefs.d, [subKey(t, line)]: open } });

  const allOpen = topics.length > 0 && topics.every(t =>
    topicOpen(t) && t.blocks.every(b => b.kind !== 'line' || !hasDetails(b) || subOpen(t, b)));
  const setAll = (open: boolean) => {
    const next: OpenPrefs = { t: { ...openPrefs.t }, d: { ...openPrefs.d } };
    topics.forEach(t => {
      next.t[t.task.id] = open;
      t.blocks.forEach(b => { if (b.kind === 'line' && hasDetails(b)) next.d[subKey(t, b)] = open; });
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

  /** Level 2 — a subtopic (a `- [ ]` line) with its level-3 details. */
  const renderSub = (t: Topic, line: LineBlock) => {
    const expandable = hasDetails(line);
    const open = expandable && subOpen(t, line);
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
            aria-label={line.checked ? 'בטל סימון' : 'סמן כנדון'}
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
            <Bold text={line.text} />
          </span>
          <button
            type="button"
            className={`${styles.noteBtn} ${line.note ? styles.noteBtnHas : ''}`}
            aria-label={line.note ? 'עריכת הערה' : 'הוספת הערה'}
            title={line.note ? 'עריכת הערה' : 'הוספת הערה'}
            onClick={() => openNote(t.task, line)}
          >
            <PencilIcon />
          </button>
        </div>
        {open && (
          <ul className={styles.details}>
            {line.quotes.map((q, i) => {
              const labeled = asLabeled(q);
              if (labeled) {
                return (
                  <li key={`q${i}`} dir={textDir(labeled.text)}>
                    <strong className={labeled.kind === 'recommendation' ? styles.recTag : styles.detailTag}>
                      {labeled.word}{labeled.date ? ` (${labeled.date})` : ''}:
                    </strong> <Bold text={labeled.text} />
                  </li>
                );
              }
              return <li key={`q${i}`} dir={textDir(q)}><Bold text={q} /></li>;
            })}
            {line.note && (
              <li dir={textDir(line.note)}><strong className={styles.detailTag}>הערה:</strong> {line.note}</li>
            )}
            {line.details.map((d, i) => (
              <li key={`d${i}`} dir={textDir(d)}><Bold text={d} /></li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  /** Level 1 — a topic, with its subtopics. */
  const renderTopic = (t: Topic) => {
    const open = topicOpen(t);
    return (
      <section key={t.task.id} className={`${styles.topic} ${t.done ? styles.topicDone : ''}`}>
        <button type="button" className={styles.topicRow} aria-expanded={open} onClick={() => setTopicOpen(t, !open)}>
          <span className={styles.topicChev}><ChevronIcon dir={open ? 'down' : 'left'} size={18} /></span>
          <span className={styles.topicTitle} dir={textDir(t.task.title)}><TopicTitle title={t.task.title} /></span>
          {t.done && <span className={styles.topicCheck} title="נדון"><CheckIcon size={12} /></span>}
          <span className={styles.spacer} />
          <span className={styles.topicCount} dir="ltr">{t.ticked}/{t.total}</span>
        </button>
        {open && (
          <ul className={styles.subs}>
            {t.blocks.map((b, i) => {
              if (b.kind === 'line') return renderSub(t, b);
              if (b.kind === 'heading') return <li key={`h${i}`} className={styles.group} dir={textDir(b.text)}>{b.text}</li>;
              return <li key={`t${i}`} className={styles.smallText} dir={textDir(b.text)}><Bold text={b.text} /></li>;
            })}
          </ul>
        )}
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
    return (
      <div key={t.id} className={`${styles.waitRow} ${inFocus ? styles.waitRowFocus : ''}`} dir="ltr">
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
        <button type="button" className={styles.waitLink} title={now ? `${t.title}\nמחכה: ${now}` : t.title} onClick={() => openTask(t)}>
          <span className={`${styles.pill} ${styles.pillSmall} ${styles.pillWaiting} ${styles.waitPill}`}>
            <HourglassIcon size={13} /> <span className={styles.waitPillText}>בהמתנה</span>
          </span>
          <span className={styles.nextText}>
            <span className={styles.waitTitle} dir={textDir(t.title)}>{t.title}</span>
            <span className={styles.waitFor} dir={textDir(now || 'מחכה')}>{now || 'מחכה — לא נכתב למה'}</span>
          </span>
          <span className={styles.nextId}>#{t.id}</span>
        </button>
        {renderLinks(t, true)}
      </div>
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
          <button type="button" className={styles.focusBody} onClick={() => openTask(t)}>
            <span className={styles.focusTitle} dir={textDir(t.title)} title={t.title}>{t.title}</span>
            <span className={styles.focusRule} />
            {now && (
              <span className={styles.focusNow} dir="rtl" title={now}>
                <strong>עכשיו:</strong> {now}
              </span>
            )}
          </button>
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
        <button type="button" className={styles.nextLink} title={now ? `${t.title}\nעכשיו: ${now}` : t.title} onClick={() => openTask(t)}>
          <span className={`${styles.pill} ${styles.pillSmall} ${pill.cls}`}>{pill.text}</span>
          <span className={styles.nextText}>
            <span className={styles.nextTitle} dir={textDir(t.title)}>{t.title}</span>
            {now && <span className={styles.taskNow} dir={textDir(now)}>{now}</span>}
          </span>
          <span className={styles.nextId}>#{t.id}</span>
        </button>
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
        <button type="button" className={styles.taskLink} title={now ? `${t.title}\nעכשיו: ${now}` : t.title} onClick={() => openTask(t)}>
          <span className={`${styles.pill} ${pill.cls}`}>{pill.text}</span>
          <span className={styles.taskText}>
            <span className={styles.taskTitle} dir={textDir(t.title)}>{t.title}</span>
            {now && <span className={styles.taskNow} dir={textDir(now)}>{now}</span>}
          </span>
          <span className={styles.vsep} />
          <span className={styles.taskId}>#{t.id}</span>
        </button>
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
              {tasks && working.length === 0 && nextTasks.length === 0 && <div className={styles.empty}>אין משימות בטיפול כרגע.</div>}
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
                <div className={styles.taskModalNow} dir="rtl"><strong>{isWaiting(modalTask) ? 'מחכה:' : 'עכשיו:'}</strong> {now}</div>
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
            <div className={styles.modalLine} dir={textDir(noteDraft.text)}><Bold text={noteDraft.text} /></div>
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

      {toast && <div className={styles.toast} role="status">{toast}</div>}
    </div>
  );
}
