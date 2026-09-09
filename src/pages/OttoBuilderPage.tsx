/**
 * Otto — build your own screen. Mockup, but a working one.
 *
 * WHAT IT IS. The same machine as Alfred in Builder V2, pointed at a different
 * artifact: Alfred talks to you and returns agent JSON, Otto talks to you and
 * returns an operational HTML screen for the Intelligence Center's Apps area.
 *
 * THE LOOP NEVER ENDS AND NEVER CHANGES. You are always in a conversation.
 * When Otto has enough he unlocks "prepare a plan"; you read the plan and
 * approve it; he builds. Then you keep talking — and the next plan is a CHANGE
 * plan stating the delta against the screen you already have. One composer,
 * one path, whether it is the first screen or the fifth revision.
 *
 * OTTO IS THE STATUS SURFACE. The three phase chips are gone; his card says
 * where you are instead. He is small, static and silent — he never greets,
 * congratulates or starts a conversation, and he is never labelled a manager,
 * because the user is the approval authority and he is the employee reporting
 * in. That restraint is the answer to the objection that a character in
 * operational software wears out: the status persists, the character does not
 * perform. See docs/design/otto-presence-answer.md and the stylesheet header.
 *
 * HALF MOCKUP, HALF REAL. The screen he writes genuinely works — it sorts,
 * filters and totals for real — because the demo dataset is injected into the
 * iframe as `DATA`. What is not real is the data source: those rows are a
 * generated retail world (otto/data/demo-dataset.js), not a customer's
 * database. Wiring it up changes one function on the server, not this page.
 *
 * WHY AN IFRAME. The generated screen brings its own <style> and <script>. In
 * the document it would leak both ways. `srcDoc` with a sandbox gives it a
 * clean document and keeps it from touching ours, which is also the honest
 * posture for code a model wrote. The framework's stylesheet is linked into
 * that document so a built screen inherits the system rather than inventing one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getBaseURL } from '../services/api';
import { useDocumentMeta } from '../hooks';
import styles from './OttoBuilderPage.module.css';

const API = () => `${import.meta.env.DEV ? 'http://localhost:3000' : getBaseURL()}/api/otto`;

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;500;600;700&display=swap';

type Phase = 'talk' | 'plan';

interface Msg { role: 'user' | 'assistant'; content: string }
interface PlanPart { name: string; detail: string }
interface Plan {
  title: string;
  summary: string;
  parts: PlanPart[];
  notes: string[];
  isChange?: boolean;
  changes?: string[];
}

const OPENING =
  'שלום. אני אוטו — אני בונה מסכים על הנתונים של הארגון.\n\n' +
  'ספר לי איזה מסך היית רוצה לעבוד איתו: מה אתה צריך לראות, ומה אתה עושה עם זה ביום־יום. ' +
  'אני מכיר את המכירות, המלאי, הפריטים, הסניפים והספקים — ואם משהו לא אפשרי מהנתונים, אגיד לך מיד.';

const EXAMPLES = [
  'מלאי מתחת למלאי הביטחון',
  'השוואת מכירות בין סניפים',
  'המלצת רכש לפי ספק',
];

/** The four steps of the loop. All four are always shown — where you are is
 *  only meaningful next to where you are going. */
const STEPS = ['שיחה', 'תכנון', 'אישור', 'בנייה'] as const;

/**
 * What Otto is doing during a build, keyed by the phase the SERVER observes in
 * the HTML as it is written. This used to be three captions on a stopwatch —
 * the one place the page claimed to know something it did not. Now the phase
 * changes when he has actually written the thing it names, so a build that
 * stalls visibly stalls instead of marching on to "almost done".
 */
const BUILD_PHASES: Record<string, string> = {
  structure: 'כותב את שלד המסך',
  style: 'מעצב אותו בשפה של המערכת',
  markup: 'בונה את האזורים והטבלאות',
  data: 'כותב את החישובים על הנתונים',
  wiring: 'מחבר את הסינון, המיון והפעולות',
  checking: 'מרכיב ובודק שהכול עובד',
};

/**
 * OTTO'S ACTIVITY LOG.
 *
 * The status card used to hold one derived sentence: a snapshot with no memory,
 * which is why three different situations all came out as "starting a
 * conversation". This is a log instead — entries appended at real events, each
 * with its own clock. The last entry is what he is doing now; the settled ones
 * behind it are what he did, and how long each took.
 *
 *   work — he is busy, the clock runs
 *   wait — the ball is in your court, he is idle
 *   done — finished, kept in the trail
 *   risk — something failed
 */
type ActKind = 'work' | 'wait' | 'done' | 'risk';

interface Act {
  id: number;
  kind: ActKind;
  title: string;
  detail: string;
  startedAt: number;
  endedAt?: number;
}

const OPENING_ACT: Act = {
  id: 0,
  kind: 'wait',
  title: 'מוכן להתחיל',
  detail: 'ספרו לי איזה מסך אתם צריכים — מה לראות בו, ומה עושים איתו ביום־יום.',
  startedAt: 0,
};

function secs(from: number, to: number) {
  const s = Math.max(0, Math.round((to - from) / 1000));
  return s < 60 ? `${s} שנ׳` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} דק׳`;
}

interface BuildProgress { phase: string; percent: number }

/**
 * Read the build's SSE stream.
 *
 * POST rather than EventSource because the request carries the plan and the
 * previous screen, which a GET-only EventSource cannot. Frames are separated by
 * a blank line and a partial frame stays in the buffer until its other half
 * arrives — a chunk boundary lands mid-JSON often enough to matter.
 */
async function streamBuild(
  body: unknown,
  onProgress: (p: BuildProgress) => void,
): Promise<{ html: string; data?: unknown }> {
  const res = await fetch(`${API()}/build/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // A server that predates the stream endpoint still builds — it just cannot
  // say how far along it is. The page notices because no progress event ever
  // arrives, and shows an indeterminate bar instead of a made-up percentage.
  if (res.status === 404) return post<{ html: string; data: unknown }>('/build', body);

  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { error?: string }).error || 'הבנייה נכשלה');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: { html: string; data?: unknown } | null = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const line = frame.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      let event: { type?: string; phase?: string; percent?: number; html?: string; data?: unknown; error?: string };
      try {
        event = JSON.parse(line.slice(5).trim());
      } catch {
        continue; // a frame we cannot read is not a reason to fail the build
      }
      if (event.type === 'progress') onProgress({ phase: event.phase || 'structure', percent: event.percent ?? 0 });
      else if (event.type === 'error') throw new Error(event.error || 'הבנייה נכשלה');
      else if (event.type === 'done') result = { html: String(event.html || ''), data: event.data };
    }
  }

  // The stream ending without a done frame means the connection dropped
  // mid-build. Saying so beats handing back an empty screen.
  if (!result || !result.html) throw new Error('הבנייה נקטעה באמצע. נסו שוב.');
  return result;
}

/** The starting icon set for a saved app. Line icons, one stroke weight, no emoji. */
const ICONS: Record<string, string> = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  box: 'M3 8l9-4 9 4v8l-9 4-9-4zM3 8l9 4 9-4M12 12v8',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 100-4 2 2 0 000 4zM17.5 19a2 2 0 100-4 2 2 0 000 4z',
  tag: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01',
  alert: 'M12 3l9 16H3zM12 10v4M12 17h.01',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.grid} />
    </svg>
  );
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || 'הבקשה נכשלה');
  return json as T;
}

export function OttoBuilderPage() {
  const { datasetId = 'demo' } = useParams<{ datasetId: string }>();

  const [phase, setPhase] = useState<Phase>('talk');
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: OPENING }]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [readyToPlan, setReadyToPlan] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  /** The plan the visible screen was built from — what a change plan diffs against. */
  const [builtPlan, setBuiltPlan] = useState<Plan | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  /** Separate from `thinking`: preparing a plan is its own step in the strip. */
  const [planning, setPlanning] = useState(false);
  /** Completed builds. The round you are IN is one more than this. */
  const [rounds, setRounds] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [buildPhase, setBuildPhase] = useState('structure');
  const [error, setError] = useState<string | null>(null);

  /** Otto's log. The last entry is now; the settled ones behind it are history. */
  const [acts, setActs] = useState<Act[]>([{ ...OPENING_ACT, startedAt: Date.now() }]);
  const actSeq = useRef(0);
  /** Re-renders the running clock once a second — nothing else reads it. */
  const [, setTick] = useState(0);
  const [data, setData] = useState<unknown>(null);

  const [saveOpen, setSaveOpen] = useState(false);
  const [appName, setAppName] = useState('');
  const [appIcon, setAppIcon] = useState('grid');
  const [appId, setAppId] = useState<string | null>(null);
  /** What the canvas bar shows — set on save, so naming it renames it here too. */
  const [savedName, setSavedName] = useState<string | null>(null);
  const [savedIcon, setSavedIcon] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  /** Append an entry and make it the current one. */
  const say = useCallback((kind: ActKind, title: string, detail: string) => {
    const id = ++actSeq.current;
    // Capped: the trail shows three, and an unbounded log is a slow leak on a
    // page a user can sit on all afternoon.
    setActs(a => [...a.slice(-11), { id, kind, title, detail, startedAt: Date.now() }]);
    return id;
  }, []);

  /** Close an entry out. It keeps its own duration and moves into the trail. */
  const settle = useCallback((id: number, title: string, detail: string) => {
    setActs(a => a.map(x => (x.id === id ? { ...x, kind: 'done' as const, title, detail, endedAt: Date.now() } : x)));
  }, []);

  const fail = useCallback((id: number, title: string, detail: string) => {
    setActs(a => a.map(x => (x.id === id ? { ...x, kind: 'risk' as const, title, detail, endedAt: Date.now() } : x)));
  }, []);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Otto's own head, cropped from the figure in public/otto — re-render the
  // figure and this has to be regenerated from it, which is why the two sit in
  // the same folder. Leaving the route restores the client's icon: every page
  // here sets its own, IntelligencePage included.
  useDocumentMeta({
    title: 'אוטו — בניית מסך',
    favicon: '/otto/otto-favicon.png',
    description: 'אוטו בונה מסכים תפעוליים על הנתונים של הארגון.',
  });

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONTS_HREF}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      document.head.appendChild(link);
    }
    fetch(`${API()}/data`).then(r => r.json()).then(d => setData(d.data)).catch(() => { /* the build supplies it */ });
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking, plan]);

  const current = acts[acts.length - 1] ?? null;
  const working = current?.kind === 'work';

  useEffect(() => {
    if (!working) return;
    const id = window.setInterval(() => setTick(t => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [working]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || thinking || building) return;

    const next: Msg[] = [...messages, { role: 'user', content: clean }];
    setMessages(next);
    setDraft('');
    setThinking(true);
    setError(null);
    setPhase('talk');

    const act = say('work', 'קורא את מה שכתבתם',
      builtPlan ? 'מבין מה צריך להשתנות במסך הקיים.' : 'מבין מה המסך צריך לעשות ואילו נתונים הוא צריך.');

    try {
      const r = await post<{ reply: string; readyToPlan: boolean; state?: string }>('/chat', {
        messages: next, currentPlan: builtPlan,
      });
      setMessages([...next, { role: 'assistant', content: r.reply }]);
      setReadyToPlan(r.readyToPlan);
      settle(act, 'עניתי לכם', 'התשובה בשיחה משמאל.');

      // `state` is Otto's own read of where things stand, asked for in the same
      // call. When it is missing the fallbacks still say something true.
      if (r.readyToPlan) {
        say('wait', 'אפשר לעבור לתכנון',
          r.state
            ? `${r.state} עכשיו אכין תוכנית — רשימת האזורים והנתונים של המסך — שתקראו ותאשרו לפני שאני בונה.`
            : 'יש לי מספיק. אכין תוכנית — רשימת האזורים והנתונים של המסך — שתקראו ותאשרו לפני שאני בונה.');
      } else {
        say('wait', 'חסר לי עוד פרט',
          r.state || 'שאלתי אתכם שאלה בשיחה. ברגע שאדע, נוכל לעבור לתכנון.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'הבקשה נכשלה';
      setError(message);
      fail(act, 'לא הצלחתי לענות', `${message} השיחה נשמרה — נסו לשלוח שוב.`);
    } finally {
      setThinking(false);
    }
  }, [messages, thinking, building, builtPlan, say, settle, fail]);

  const preparePlan = useCallback(async () => {
    setThinking(true);
    setPlanning(true);
    setError(null);

    const act = say('work', builtPlan ? 'מנסח את השינוי' : 'מנסח תוכנית',
      builtPlan
        ? 'מגדיר בדיוק מה משתנה במסך הקיים ומה נשאר.'
        : 'מסכם את השיחה לאזורים, לנתונים ולכללים של המסך.');

    try {
      const r = await post<{ plan: Plan }>('/plan', { messages, currentPlan: builtPlan });
      setPlan(r.plan);
      setPhase('plan');

      const count = r.plan.isChange ? (r.plan.changes?.length || 0) : r.plan.parts.length;
      settle(act, 'התוכנית מוכנה',
        r.plan.isChange ? `${count} שינויים למסך הקיים.` : `${count} אזורים על המסך.`);
      say('wait', 'ההחלטה שלכם',
        'קראו את התוכנית בשיחה. אם היא מדויקת — אשרו, ואני בונה. אם לא — תגידו לי מה לתקן ואנסח מחדש.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'לא הצלחתי לנסח תוכנית';
      setError(message);
      fail(act, 'לא הצלחתי לנסח תוכנית', `${message} השיחה נשמרה — אפשר לנסות שוב.`);
    } finally {
      setThinking(false);
      setPlanning(false);
    }
  }, [messages, builtPlan, say, settle, fail]);

  const approveAndBuild = useCallback(async () => {
    if (!plan) return;
    setBuilding(true);
    setError(null);
    setSavedAs(null);
    setProgress(null);
    setBuildPhase('structure');

    const act = say('work', plan.isChange ? 'מעדכן את המסך' : 'בונה את המסך', BUILD_PHASES.structure);

    try {
      const r = await streamBuild({ plan, previousHtml: html }, ({ phase: p, percent }) => {
        setProgress(percent);
        setBuildPhase(p);
        // The current entry's detail tracks the phase, so the card says what he
        // is doing right now rather than what he set out to do a minute ago.
        setActs(a => a.map(x => (x.id === act ? { ...x, detail: BUILD_PHASES[p] || x.detail } : x)));
      });

      setProgress(100);
      setHtml(r.html);
      if (r.data) setData(r.data);
      setBuiltPlan(plan);
      setReadyToPlan(false);
      setPhase('talk');
      setMessages(m => [...m, {
        role: 'assistant',
        content: `המסך "${plan.title}" ${plan.isChange ? 'עודכן' : 'נבנה'}. תסתכל עליו — ואם משהו לא מדויק, פשוט תגיד לי מה לשנות.`,
      }]);
      setRounds(n => n + 1);
      settle(act, plan.isChange ? 'המסך עודכן' : 'המסך נבנה',
        plan.isChange ? `${plan.changes?.length || 0} שינויים הוחלו.` : `${plan.parts.length} אזורים על המסך.`);
      say('wait', 'המסך מוכן לבדיקה',
        'תסתכלו עליו ותנסו אותו. כל שינוי — פשוט תגידו לי מה, ונחזור לאותו מסלול: שיחה, תוכנית, אישור.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'הבנייה נכשלה';
      setError(message);
      setPhase('talk');
      fail(act, 'הבנייה נעצרה',
        html ? `${message} המסך הקודם נשאר כפי שהיה.` : `${message} התוכנית נשמרה — אפשר לאשר שוב.`);
    } finally {
      setBuilding(false);
      setProgress(null);
    }
  }, [plan, html, say, settle, fail]);

  const confirmSave = useCallback(async () => {
    if (!builtPlan || !html || !appName.trim()) return;
    setError(null);
    try {
      const r = await post<{ app: { id: string; title: string } }>(`/apps/${datasetId}`, {
        id: appId, title: appName.trim(), summary: builtPlan.summary, icon: appIcon,
        plan: builtPlan, html, createdBy: 'demo',
      });
      setAppId(r.app.id);
      // The name and icon are the app's identity from here on, so the canvas
      // bar adopts them — otherwise you name a thing and nothing changes.
      setSavedName(r.app.title);
      setSavedIcon(appIcon);
      setSavedAs(r.app.title);
      setSaveOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השמירה נכשלה');
    }
  }, [builtPlan, html, appName, appIcon, appId, datasetId]);

  const restart = useCallback(() => {
    setPhase('talk');
    setMessages([{ role: 'assistant', content: OPENING }]);
    setPlan(null);
    setBuiltPlan(null);
    setHtml(null);
    setReadyToPlan(false);
    setAppId(null);
    setSavedName(null);
    setSavedIcon(null);
    setSavedAs(null);
    setError(null);
    setProgress(null);
    setRounds(0);
    actSeq.current = 0;
    setActs([{ ...OPENING_ACT, startedAt: Date.now() }]);
  }, []);

  const srcDoc = useMemo(() => {
    if (!html || !data) return null;
    // The theme is LINKED, not inlined: an app saved today picks up a theme fix
    // tomorrow, and the 700-line stylesheet stays out of every srcDoc string.
    return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS_HREF}">
<link rel="stylesheet" href="${API()}/theme.css">
</head><body>
<script>const DATA = ${JSON.stringify(data)};</script>
${html}
<script>
  const report = () => parent.postMessage({ ottoHeight: document.documentElement.scrollHeight }, '*');
  window.addEventListener('load', report);
  new ResizeObserver(report).observe(document.body);
</script>
</body></html>`;
  }, [html, data]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const h = (e.data as { ottoHeight?: number })?.ottoHeight;
      if (typeof h === 'number' && frameRef.current) {
        frameRef.current.style.height = `${Math.max(320, Math.min(h + 8, 12000))}px`;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /**
   * WHERE YOU ARE IN THE LOOP — the four steps.
   *
   * `fill` is how far through the CURRENT step you are: a real fraction during
   * a build, 1 when the step is complete but you have not moved on, and null
   * when he is working with no measurable end (the strip animates instead of
   * lying about a percentage). `next` marks the step you may now move to, which
   * is what "he is ready to make a plan" actually means on screen.
   */
  const flow: { at: number; fill: number | null; next: number | null } = (() => {
    if (building) return { at: 3, fill: progress === null ? null : progress / 100, next: null };
    if (planning) return { at: 1, fill: null, next: null };
    if (phase === 'plan') return { at: 2, fill: 1, next: 3 };
    if (thinking) return { at: 0, fill: null, next: null };
    // A finished build completes the WHOLE cycle, not just its last step. `at`
    // sits past the end so all four read as done and none reads as current —
    // there is nothing in progress, and the next message starts a fresh round.
    if (builtPlan) return { at: 4, fill: null, next: null };
    if (readyToPlan) return { at: 0, fill: 1, next: 1 };
    return { at: 0, fill: 0, next: null };
  })();

  const failed = current?.kind === 'risk';

  const stepClass = (i: number) => {
    const c = [styles.step];
    if (i < flow.at) c.push(styles.stepDone);
    if (i === flow.at) c.push(failed ? styles.stepFailed : styles.stepNow);
    if (i === flow.next) c.push(styles.stepNext);
    return c.join(' ');
  };

  /** How much of a step's own track is filled. Past steps are simply full. */
  const stepFill = (i: number) => {
    if (i < flow.at) return 1;
    if (i !== flow.at) return 0;
    return flow.fill ?? 0;
  };

  /** The trail: what he already did, newest first, waits excluded — a step you
   *  are standing on is not an achievement. */
  const trail = acts
    .slice(0, -1)
    .filter(a => a.kind === 'done' || a.kind === 'risk')
    .slice(-3)
    .reverse();

  const buildLine = BUILD_PHASES[buildPhase] || BUILD_PHASES.structure;

  const title = savedName || builtPlan?.title || plan?.title || 'מסך חדש';

  return (
    <div className={styles.page}>
      {/* ── What is being built ── */}
      <main className={styles.canvas}>
        <div className={styles.canvasBar}>
          {savedIcon && (
            <div className={styles.canvasIcon}><Icon name={savedIcon} size={17} /></div>
          )}
          <div>
            <p className={styles.canvasTitle}>{title}</p>
            <p className={styles.canvasMeta}>
              {html ? 'רץ על נתוני הדגמה — לא מחובר לנתוני לקוח' : 'טרם נבנה'}
            </p>
          </div>
          <div className={styles.spacer} />
          {html && (
            <>
              <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={restart}>
                מסך חדש
              </button>
              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnPrimary}`}
                onClick={() => { setAppName(savedName || builtPlan?.title || ''); setSaveOpen(true); }}>
                {appId ? 'עדכון האפליקציה' : 'שמירה לאפליקציות'}
              </button>
            </>
          )}
        </div>

        {/* Flush whenever a real screen is on the glass — see .canvasFlush. */}
        <div className={`${styles.canvasBody} ${srcDoc ? styles.canvasFlush : ''}`}>
          {/* The canvas says WHAT is being built; Otto's card says how far along
              it is. Listing the stages here as well would be the same mistake as
              keeping the phase chips next to him — two places reporting one
              thing, drifting apart the moment either changes. */}
          {/* BUILDING, WITH A SCREEN ALREADY THERE. The screen you have stays
              on the glass — dimmed and inert — under a banner saying what is
              being done to it. Replacing it with a spinner threw away the one
              thing you need in order to judge the change. */}
          {building && srcDoc && (
            <div className={styles.frameWrap}>
              <div className={styles.buildBanner}>
                <span className={`${styles.dot} ${styles.dotWork}`} />
                <div className={styles.bannerText}>
                  <p className={styles.bannerTitle}>מעדכן את המסך</p>
                  <p className={styles.bannerLine}>{buildLine}</p>
                </div>
                {progress !== null && <span className={styles.bannerPct}>{progress}%</span>}
                <div className={`${styles.bannerBar} ${progress === null ? styles.barBusy : ''}`}>
                  {progress !== null && <span className={styles.barFill} style={{ width: `${progress}%` }} />}
                </div>
              </div>
              <div className={`${styles.frame} ${styles.frameBusy}`} aria-busy="true">
                <iframe ref={frameRef} className={styles.preview} title={title}
                  srcDoc={srcDoc} sandbox="allow-scripts" style={{ height: 520 }} />
              </div>
            </div>
          )}

          {/* BUILDING THE FIRST SCREEN. Nothing to show yet, so the arena shows
              the work itself: real progress, the phase he has actually reached,
              and the parts he is building — the plan you just approved, so you
              can read it back while it happens. */}
          {building && !srcDoc && (
            <div className={styles.buildBox}>
              <div className={styles.buildInner}>
                <p className={styles.emptyTitle}>{plan?.isChange ? 'מעדכן את המסך' : 'בונה את המסך'}</p>
                <p className={styles.emptyText}>{plan?.title}</p>

                <div className={`${styles.buildBar} ${progress === null ? styles.barBusy : ''}`}
                  role="progressbar" aria-valuenow={progress ?? undefined} aria-valuemin={0} aria-valuemax={100}>
                  {progress !== null && <span className={styles.barFill} style={{ width: `${progress}%` }} />}
                </div>
                <p className={styles.buildNow}>
                  {progress !== null && <span className={styles.buildPct}>{progress}%</span>}
                  {buildLine}
                </p>

                {plan?.parts && plan.parts.length > 0 && (
                  <ul className={styles.buildParts}>
                    {plan.parts.map(part => (
                      <li key={part.name}>{part.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!building && srcDoc && (
            <div className={styles.frame}>
              <iframe ref={frameRef} className={styles.preview} title={title}
                srcDoc={srcDoc} sandbox="allow-scripts" style={{ height: 520 }} />
            </div>
          )}

          {/* Built but unrenderable. This used to fall through to the empty
              state, so a failure looked exactly like "you haven't started yet". */}
          {!building && html && !srcDoc && (
            <div className={styles.empty}>
              <div className={styles.emptyInner}>
                <p className={styles.emptyTitle}>המסך נבנה אבל אי אפשר להציג אותו</p>
                <p className={styles.emptyText}>
                  נתוני ההדגמה לא נטענו, ולכן אין על מה להריץ את המסך. בדוק שהשרת רץ ונסה לבנות שוב.
                </p>
              </div>
            </div>
          )}

          {!building && !html && (
            <div className={styles.empty}>
              <div className={styles.emptyInner}>
                <p className={styles.emptyTitle}>כאן ייבנה המסך שלכם</p>
                <p className={styles.emptyText}>
                  תארו בצ׳אט איזה מסך אתם צריכים ואילו נתונים הוא צריך להציג.
                </p>
                <div className={styles.examples}>
                  {EXAMPLES.map(ex => (
                    // Inserts into the composer rather than sending. A click
                    // that silently starts a build takes the decision away.
                    <button key={ex} type="button" className={styles.example}
                      onClick={() => { setDraft(ex); inputRef.current?.focus(); }}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Otto, on the boundary between the two columns ──
          He stands where the description meets the thing being built, because
          that is what he does. A status surface only: no greeting, no
          celebration, no conversation of its own, and no animation — moving
          him would turn a persistent indicator into a performance. */}
      <div className={styles.ottoCentre}>
        {/* His card is a log, not a label: what he is doing, how long it has
            been running, and the last few things he finished. `polite` so a
            screen reader hears each change once it settles rather than on
            every percentage tick. */}
        <div className={styles.ottoStatus} aria-live="polite">
          <div className={styles.statusHead}>
            <span className={`${styles.dot} ${
              current?.kind === 'work' ? styles.dotWork
                : current?.kind === 'risk' ? styles.dotRisk
                : styles.dotWait}`} />
            <p className={`${styles.ottoTitle} ${current?.kind === 'risk' ? styles.ottoTitleRisk : ''}`}>
              {current?.title}
            </p>
            {current?.kind === 'work' && (
              <span className={styles.clock}>{secs(current.startedAt, Date.now())}</span>
            )}
          </div>

          <p className={styles.ottoLine}>{current?.detail}</p>

          {building && (
            progress === null
              ? <div className={`${styles.bar} ${styles.barBusy}`} role="progressbar" aria-label="בונה" />
              : (
                <div className={styles.bar} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <span className={styles.barFill} style={{ width: `${progress}%` }} />
                </div>
              )
          )}

          {trail.length > 0 && (
            <ul className={styles.trail}>
              {trail.map(a => (
                <li key={a.id} className={a.kind === 'risk' ? styles.trailRisk : undefined}>
                  <span className={styles.trailMark} aria-hidden="true">{a.kind === 'risk' ? '×' : '✓'}</span>
                  <span className={styles.trailText}>{a.title}</span>
                  {a.endedAt && <span className={styles.trailTime}>{secs(a.startedAt, a.endedAt)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <img className={styles.ottoFigure} src="/otto/otto-cut.png" alt="אוטו" />
      </div>

      {/* ── The rail ── */}
      <aside className={styles.chat}>
        {/* Who you are talking to, and where you are in the loop. The bubble on
            the seam says what Otto is saying RIGHT NOW; this says where that
            sits in the process — two different questions, two places. */}
        <div className={styles.railHead}>
          <div className={styles.railWho}>
            <p className={styles.railName}>אוטו</p>
            <p className={styles.railRole}>בונה מסכים על הנתונים שלכם</p>
            {/* The strip resets every round, so without this a fifth revision
                looks exactly like a first draft. */}
            {rounds > 0 && <span className={styles.round}>סבב {rounds + 1}</span>}
          </div>
          {/* One track per step and nothing nested inside it. The build step
              used to sprout three sub-segments of its own, which read as a
              second, competing progress display. The build's progress now
              fills this step's own track. */}
          <div className={styles.process}>
            {STEPS.map((label, i) => (
              <div key={label} className={stepClass(i)}>
                <span className={styles.stepLabel}>{label}</span>
                <span className={`${styles.stepTrack} ${i === flow.at && flow.fill === null ? styles.stepBusy : ''}`}>
                  <span className={styles.stepFill} style={{ transform: `scaleX(${stepFill(i)})` }} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.messages} ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgBot}`}>
              {m.content}
            </div>
          ))}

          {thinking && <div className={styles.typing}>אוטו כותב…</div>}

          {plan && phase === 'plan' && (
            <div className={styles.planCard}>
              <p className={styles.planLabel}>{plan.isChange ? 'תוכנית שינוי לאישור' : 'תוכנית לאישור'}</p>
              <p className={styles.planTitle}>{plan.title}</p>
              <p className={styles.planSummary}>{plan.summary}</p>

              {plan.isChange && plan.changes && plan.changes.length > 0 && (
                <div className={styles.delta}>
                  <p>מה משתנה</p>
                  <ul>{plan.changes.map(c => <li key={c}>{c}</li>)}</ul>
                </div>
              )}

              <ul className={styles.planParts}>
                {plan.parts.map(p => (
                  <li key={p.name} className={styles.planPart}>
                    <b>{p.name}</b>
                    <span>{p.detail}</span>
                  </li>
                ))}
              </ul>

              {plan.notes.length > 0 && (
                <div className={styles.planNotes}>
                  <p>שים לב</p>
                  <ul>{plan.notes.map(n => <li key={n}>{n}</li>)}</ul>
                </div>
              )}

              <div className={styles.planActions}>
                {/* Both locked while a build runs: the card stays on screen so
                    you can read what you approved, and a second click used to
                    start a second build over the top of the first. */}
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={building} onClick={() => void approveAndBuild()}>
                  {building ? 'בונה…' : plan.isChange ? 'אישור ועדכון' : 'אישור ובנייה'}
                </button>
                <button type="button" className={styles.btn} disabled={building}
                  onClick={() => { setPhase('talk'); setPlan(null); }}>
                  חזרה לשיחה
                </button>
              </div>
            </div>
          )}

          {/* The generic status line never replaces the real diagnostic — it
              sits next to the thing that failed, with a way to retry. */}
          {error && (
            <div className={styles.error}>
              {error}
              <div className={styles.planActions} style={{ marginTop: 8 }}>
                <button type="button" className={styles.btn} onClick={() => setError(null)}>סגירה</button>
              </div>
            </div>
          )}
          {savedAs && <p className={styles.saved}>נשמר. "{savedAs}" זמין עכשיו באפליקציות של מרכז האינטליגנס.</p>}
        </div>

        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(draft); } }}
            placeholder={html ? 'מה לשנות במסך?' : 'מה המסך צריך להראות?'}
            disabled={thinking || building}
            rows={2}
          />
          <div className={styles.row}>
            <button type="button" className={styles.btn} disabled={!draft.trim() || thinking || building}
              onClick={() => void send(draft)}>
              שליחה
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={!readyToPlan || thinking || building || phase === 'plan'}
              onClick={() => void preparePlan()}
              title={readyToPlan ? 'סיכום מה שסיכמנו לתוכנית' : 'ספר לאוטו עוד קצת על מה שאתה צריך'}>
              {html ? 'תוכנית שינוי' : 'מעבר לתוכנית'}
            </button>
          </div>
          <p className={styles.hint}>Enter לשליחה · Shift+Enter לשורה חדשה</p>
        </div>
      </aside>

      {/* ── Save: name it and give it an icon ── */}
      {saveOpen && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="שמירת אפליקציה">
          <div className={styles.dialog}>
            <p className={styles.dialogTitle}>{appId ? 'עדכון האפליקציה' : 'שמירה לאפליקציות'}</p>
            <p className={styles.dialogText}>
              המסך יופיע באזור האפליקציות של מרכז האינטליגנס, ואפשר יהיה לפתוח אותו משם.
            </p>

            <label className={styles.field}>
              <span>שם האפליקציה</span>
              <input className={styles.textInput} value={appName} onChange={e => setAppName(e.target.value)}
                maxLength={40} autoFocus />
            </label>

            <div className={styles.field}>
              <span>אייקון</span>
              <div className={styles.iconGrid}>
                {Object.keys(ICONS).map(name => (
                  <button key={name} type="button"
                    className={`${styles.iconBtn} ${appIcon === name ? styles.iconBtnOn : ''}`}
                    onClick={() => setAppIcon(name)} aria-label={name} aria-pressed={appIcon === name}>
                    <Icon name={name} />
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.dialogActions}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!appName.trim()} onClick={() => void confirmSave()}>
                שמירה
              </button>
              <button type="button" className={styles.btn} onClick={() => setSaveOpen(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
