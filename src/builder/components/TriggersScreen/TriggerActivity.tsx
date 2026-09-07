/**
 * TriggerActivity — "what has happened on the chat I have open".
 *
 * A tall panel beside the Watching lane. Not the admin feed: that one
 * is every conversation on the agent and is for reading later. This is
 * one chat, right now, while you are working on it — which is why it
 * sits on the authoring screen and why it never shows anybody else.
 *
 * ── What it shows ──────────────────────────────────────────────────
 *
 *   Running now   an event row the server opened and has not closed.
 *                 This is the whole reason the panel polls: a crew
 *                 started by the CLOCK gives no other sign, and "is
 *                 something happening right now?" was unanswerable.
 *   Runs          the same rows once closed, with their outcome.
 *   Asks          "will it trigger?" and the answer. Session-only —
 *                 nothing was run, so there is no server row, and
 *                 inventing one would record something that did not
 *                 happen.
 *
 * Runs come from the server, so they survive a reload and include work
 * nobody on this screen started. Asks do not, and should not.
 *
 * ── Reading it ─────────────────────────────────────────────────────
 *
 * Every result is the same three fields in the same places: the trigger
 * NAME, a STATE pill, and the REASON underneath. Whether something ran
 * is carried by the pill's colour and wording, not by a clause buried
 * in a sentence — which is what the first version did, and why six
 * entries in a row were unreadable.
 *
 * Entries are separate CARDS with a gap between them, not rows sharing
 * one surface. Tinted rows stacked flush merged into one block of
 * colour the moment two neighbours agreed, which is most of the time.
 *
 * ── Two tiers ──────────────────────────────────────────────────────
 *
 *   What you DID      indigo, compact — "You ran all triggers".
 *   What HAPPENED     green / amber / red — one card per outcome.
 *
 * They are drawn unalike because they are different kinds of thing. A
 * run produces both (you pressed a button; then N triggers each did
 * something), and when the two looked identical it was impossible to
 * tell which card was which. An agent-wide run therefore reads as one
 * action followed by its results, which is what actually happened.
 *
 * Exactly one pill per line, and only the all-triggers case shows its
 * scope. Two rows of chips per entry — a scope chip above, a state pill
 * below — made a short answer look heavy.
 *
 * ── Polling ────────────────────────────────────────────────────────
 *
 * Every few seconds while a chat is open and the tab is visible, plus
 * immediately whenever something on this screen writes (`runsNonce`).
 * The immediate refetch is what makes a run appear the instant you
 * press the button instead of up to one poll later.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchConversationTriggerEvents, type TriggerEventRow } from '../../state/triggersApi';
import { useActivityLog, stateOfOutcome, type TriggerState } from './activityLog';
import type { AgentTrigger } from '../../types';
import styles from './TriggersScreen.module.css';

interface Props {
  agentSlug: string;
  conversationId: number | null;
  triggers: AgentTrigger[];
}

const POLL_MS = 4000;

/** One vocabulary for both sources, so the same thing always looks the same. */
const STATE: Record<TriggerState, { pill: string; cls: string }> = {
  running:   { pill: 'Running now',     cls: 'pillRun' },
  sent:      { pill: 'Message sent',    cls: 'pillOk' },
  // The chain RAN and chose to stay quiet — a real outcome, so not
  // amber, but not the green of a delivered message either.
  noMessage: { pill: 'Ran, no message', cls: 'pillMuted' },
  due:       { pill: 'Due now',         cls: 'pillOk' },
  // Amber, not grey. Grey read as "disabled" rather than as an answer.
  notDue:    { pill: 'Not due yet',     cls: 'pillWarn' },
  skipped:   { pill: 'Skipped',         cls: 'pillWarn' },
  held:      { pill: 'Held',            cls: 'pillWarn' },
  blocked:   { pill: 'Blocked',         cls: 'pillWarn' },
  failed:    { pill: 'Failed',          cls: 'pillBad' },
};

/**
 * Was this run started by a person, or by the clock?
 *
 * Read off the row's own `source`, so it survives a refresh and is
 * right for runs this browser never started. The string check is the
 * fallback for rows written before that column existed — back then the
 * only marker was a sentence in `matchReason`, which is exactly why it
 * could not also carry the arithmetic, and why an agent-wide Run showed
 * up as the clock's work.
 */
function startedByHand(e: TriggerEventRow): boolean {
  if (e.source) return e.source === 'manual';
  return (e.matchReason || '').startsWith('run by hand');
}

function relative(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Did anything actually happen? Decides the entry's background.
 *
 * Green when a chain ran (message or not — running IS the event), red
 * when something failed, amber otherwise: due, not due, skipped, held,
 * blocked all mean "nothing happened yet". Colour carries the answer
 * before any word is read, which is the point of a feed you scan.
 */
function toneOf(states: TriggerState[]): string {
  if (states.some(s => s === 'failed')) return 'entryBad';
  if (states.some(s => s === 'sent' || s === 'noMessage' || s === 'running')) return 'entryRan';
  return 'entryIdle';
}

function Line({ name, state, detail }: { name: string; state: TriggerState; detail?: string }) {
  const s = STATE[state];
  return (
    <div className={styles.aLine}>
      <span className={styles.aName}>{name}</span>
      <span className={`${styles.pill} ${styles[s.cls]}`}>{s.pill}</span>
      {detail && <span className={styles.aDetail}>{detail}</span>}
    </div>
  );
}

export function TriggerActivity({ agentSlug, conversationId, triggers }: Props) {
  const { asks, runsNonce } = useActivityLog();
  const [events, setEvents] = useState<TriggerEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const nameOf = useCallback(
    (triggerId: string) => triggers.find(t => t.id === triggerId)?.name || 'Trigger',
    [triggers],
  );

  // Kept in a ref so an in-flight fetch for the PREVIOUS chat cannot
  // land in this one's list. Written in an effect, never during render.
  const convRef = useRef(conversationId);
  useEffect(() => { convRef.current = conversationId; }, [conversationId]);

  const load = useCallback(async () => {
    if (conversationId === null) return;
    try {
      const r = await fetchConversationTriggerEvents(agentSlug, conversationId);
      if (convRef.current !== conversationId) return;
      setEvents(r.events || []);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [agentSlug, conversationId]);

  // Fetch inside an async continuation, deduped by key — the house
  // pattern. React 19's StrictMode double-invokes effects, and a
  // synchronous setState in an effect body is both a lint error and the
  // thing that leaves a panel stuck on its first render.
  const inFlight = useRef<string | null>(null);
  useEffect(() => {
    const key = `${agentSlug}:${conversationId}:${runsNonce}`;
    if (inFlight.current === key) return;
    inFlight.current = key;
    void (async () => {
      if (conversationId === null) { setEvents([]); return; }
      try {
        const r = await fetchConversationTriggerEvents(agentSlug, conversationId);
        if (convRef.current !== conversationId) return;
        setEvents(r.events || []);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [agentSlug, conversationId, runsNonce]);

  useEffect(() => {
    if (conversationId === null) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      void load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load, conversationId]);

  // While a press of yours is still in flight, its own "running" row is
  // hidden: the action entry above already says it is running, and two
  // cards describing one run — which is what you saw before — is worse
  // than one. Runs the CLOCK started have no action entry, so theirs
  // always show.
  const awaitingOwnRun = asks.some(a => a.pending);
  const running = events.filter(e =>
    e.status === 'running' && !(awaitingOwnRun && startedByHand(e)));
  const done = events.filter(e => e.status !== 'running');

  // One list, newest first. Asks and runs interleave because that is the
  // order they happened in, and "I asked, then I ran it" is the story
  // the panel exists to tell.
  const merged = [
    ...done.map(e => ({ kind: 'run' as const, at: e.matchedAt, e })),
    ...asks.map(a => ({ kind: 'ask' as const, at: a.at, a })),
  ].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  return (
    <aside className={styles.activity}>
      <div className={styles.activityHead}>
        <span className={styles.activityTitle}>Activity</span>
        <span className={styles.activitySub}>
          {conversationId === null ? 'no chat open' : 'the chat you have open'}
        </span>
      </div>

      {error && <div className={styles.activityErr}>{error}</div>}

      {running.length > 0 && (
        <div className={styles.activityRunning}>
          {running.map(e => (
            <div key={e.id} className={`${styles.aEntry} ${styles.entryRan}`}>
              <div className={styles.aTop}>
                <span className={styles.aSpinner} aria-hidden />
                <span className={styles.aKind}>{startedByHand(e) ? 'You started this' : 'The clock started a run'}</span>
                <span className={styles.aWhen}>{relative(e.matchedAt)}</span>
              </div>
              <Line name={nameOf(e.triggerId)} state="running" detail={e.matchReason || undefined} />
            </div>
          ))}
        </div>
      )}

      {merged.length === 0 && running.length === 0 ? (
        <div className={styles.activityEmpty}>
          {conversationId === null
            ? 'Start a chat, or open one from history, and anything your triggers do to it shows up here.'
            : 'Nothing yet. Ask whether a trigger will fire, or run one, and it appears here — along with anything the clock does to this chat on its own.'}
        </div>
      ) : (
        <ol className={styles.activityList}>
          {merged.map(item => item.kind === 'run' ? (
            <li key={`r${item.e.id}`}
                className={`${styles.aEntry} ${styles[toneOf([stateOfOutcome(item.e.outcome, item.e.status)])]}`}>
              <div className={styles.aTop}>
                {/* The server row knows whether a person started it — the
                    route stamps the reason — so the client does not need
                    to log a second entry saying so. */}
                <span className={startedByHand(item.e) ? styles.aKindRun : styles.aKind}>
                  {startedByHand(item.e) ? 'You ran' : 'The clock ran'}
                </span>
                <span className={styles.aWhen}>{relative(item.e.matchedAt)}</span>
              </div>
              <Line
                name={nameOf(item.e.triggerId)}
                state={stateOfOutcome(item.e.outcome, item.e.status)}
                detail={item.e.error || (startedByHand(item.e) ? undefined : item.e.matchReason || undefined)}
              />
            </li>
          ) : (
            /* TIER 1 — what YOU did. Indigo and compact, deliberately
               unlike the outcome cards: an action and its result are
               different kinds of thing, and drawing them the same is why
               two entries for one run were impossible to tell apart. */
            <li key={item.a.id} className={`${styles.aEntry} ${styles.entryAction}`}>
              <div className={styles.aTop}>
                {item.a.pending && <span className={styles.aSpinner} aria-hidden />}
                <span className={styles.aKindRun}>
                  {item.a.action === 'run'
                    ? (item.a.pending ? 'You started a run' : 'You ran')
                    : 'You asked'}
                </span>
                <span className={styles.aScopeAll}>
                  {item.a.scopeAll ? 'all triggers' : item.a.scope}
                </span>
                <span className={styles.aWhen}>{relative(item.a.at)}</span>
              </div>
              {item.a.note && <div className={styles.aNote}>{item.a.note}</div>}
              {/* A run's outcomes arrive as their own rows below, so it
                  carries lines only for triggers that never got that far
                  (switched off, no crew) and for a read-only ask, whose
                  answer IS the entry. */}
              {item.a.lines.map((l, i) => (
                <Line key={i} name={l.trigger} state={l.state} detail={l.detail} />
              ))}
              {item.a.action === 'run' && item.a.pending && item.a.lines.length === 0 && (
                <div className={styles.aDetail}>Waiting for the crew…</div>
              )}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
