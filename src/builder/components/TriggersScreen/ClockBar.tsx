/**
 * ClockBar — the system heartbeat, on the Triggers screen and the admin
 * Triggers tab.
 *
 * Deliberately the FIRST thing on both pages. A trigger card that says
 * "on" while the clock is paused would be a lie, so the state that
 * decides whether anything runs at all sits above everything it governs.
 *
 * The clock is system-wide, not per agent — the same switch on every
 * agent's screen. That's in the copy rather than hidden, because
 * somebody pausing it here needs to know they just paused it everywhere.
 *
 * ── The test buttons ───────────────────────────────────────────────
 *
 * Both act on THIS agent and on the ONE chat open in the builder chat
 * panel. Neither is system-wide, and that is the point: a button that
 * could message everyone who happens to be due, across every agent, is
 * not something a person should be able to press while building.
 * Sweeping the world is the clock's job, and the clock alone does it.
 *
 *   Check     ask every trigger on this agent whether the open chat is
 *             due, and show the arithmetic. Runs nothing.
 *   Run all   run them all on that chat, due or not, to see what the
 *             chains actually produce.
 *
 * A third, narrower one lives inside each trigger: run just that one.
 *
 * The scope lives in the group's CAPTION, not in the button labels, so
 * the buttons can be plain verbs. An earlier version put it in the
 * label — "Round on #2342" — which was both long and meaningless: a
 * conversation id means nothing to anyone who has not opened the
 * database.
 *
 * While it's running this polls, so both hosting screens refresh on
 * their own as fires land. It stops polling the moment the clock is
 * paused or the tab is hidden: a paused clock produces nothing to see,
 * and a background tab has nobody looking.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchClockHealth, setClockEnabled, updateClockSettings, fireRound,
  type ClockHealth,
} from '../../state/triggersApi';
import { useBuilder } from '../../state/BuilderContext';
import { bodyOfAgent, bodyOfCrew } from '../../state/useProjectSync';
import styles from './TriggersScreen.module.css';

interface Props {
  agentSlug: string;
  /** Called after a tick — manual or polled — so the host can refresh. */
  onTicked?: () => void;
}

function relative(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || !Number.isFinite(ms)) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function intervalLabel(sec: number): string {
  return sec < 60 ? `${sec} sec` : `${Math.round(sec / 60)} min`;
}

export function ClockBar({ agentSlug, onTicked }: Props) {
  // The conversation the builder chat currently has open — the only one
  // the per-conversation round is allowed to touch.
  const { doc, previewConversationId } = useBuilder();
  const [health, setHealth] = useState<ClockHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Kept in a ref so the poll below doesn't restart every time the host
  // re-renders with a new callback identity.
  const onTickedRef = useRef(onTicked);
  useEffect(() => { onTickedRef.current = onTicked; }, [onTicked]);

  const load = useCallback(async () => {
    try {
      setHealth(await fetchClockHealth(agentSlug));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [agentSlug]);

  useEffect(() => { void load(); }, [load]);

  const on = !!health?.enabled;
  const pollMs = Math.max(3000, Math.min((health?.intervalSeconds ?? 60) * 1000, 30000));

  // Refresh while the clock is running so a fire shows up without anyone
  // pressing anything. Paused clock → no poll; hidden tab → no poll.
  useEffect(() => {
    if (!on) return;
    let stopped = false;
    const timer = setInterval(() => {
      if (stopped || document.hidden) return;
      void (async () => {
        try {
          setHealth(await fetchClockHealth(agentSlug));
          onTickedRef.current?.();
        } catch { /* transient — keep the last known state */ }
      })();
    }, pollMs);
    return () => { stopped = true; clearInterval(timer); };
  }, [on, pollMs, agentSlug]);

  const patch = async (fn: () => Promise<ClockHealth>) => {
    setBusy(true);
    try {
      setHealth(await fn());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Act on ONLY the chat open beside this screen. Sends the working
  // copies, so it exercises exactly what is on screen.
  const roundOnConversation = async (mode: 'simulate' | 'force') => {
    if (previewConversationId === null) return;
    setBusy(true);
    setLastRun(null);
    try {
      const agent = doc.agents.find(a => a.slug === agentSlug) || doc.agents[0];
      const r = await fireRound({
        agentSlug,
        mode,
        conversationId: previewConversationId,
        triggers: agent?.triggers?.triggers,
        overrideAgentBody: agent ? bodyOfAgent(agent) : undefined,
        overrideCrewBodies: agent
          ? Object.fromEntries(agent.crews.map(c => [c.id, bodyOfCrew(c)]))
          : undefined,
      });
      // Name what happened per trigger. A bare "0 sent" is the least
      // useful thing it could say — the reason each one stood down is
      // the answer the author came for.
      //
      // "ran → no message" is a normal outcome and is worded so it
      // reads that way: a trigger starts a CHAIN, and whether that
      // chain ends in a message is the chain's business, not the
      // trigger's.
      const parts = r.results.map(x => `${x.name || x.triggerId}: ${
        x.outcome === 'spoke'       ? 'ran → sent a message'
        : x.outcome === 'silent'    ? 'ran → no message'
        : x.outcome === 'would_run' ? `would run now — ${x.why}`
        : x.outcome === 'not_due'   ? `not due yet — ${x.why}`
        : x.outcome === 'skipped'   ? `skipped — ${x.why}`
        : x.outcome === 'filtered'  ? 'blocked by conditions'
        : x.outcome === 'quiet_hours' ? 'held — quiet hours'
        : `failed — ${x.why || 'unknown'}`}`);
      const head = mode === 'simulate' ? 'Checked the open chat' : 'Ran on the open chat';
      setLastRun(
        (r.masterOff ? 'This agent’s Triggers switch is off — the clock would skip it. ' : '')
        + (r.results.length === 0
            ? `${head}: this agent has no triggers yet.`
            : `${head} — ${parts.join(' · ')}`),
      );
      setError(null);
      onTickedRef.current?.();
      void load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const watching = health?.agentsWithTriggers?.length ?? 0;

  return (
    <div className={`${styles.clock} ${on ? styles.clockOn : ''}`}>
      <div className={styles.clockMain}>
        <span className={styles.clockDot} aria-hidden />
        <div className={styles.clockText}>
          <div className={styles.clockTitle}>
            {on ? 'The clock is running' : 'The clock is paused'}
            <span className={styles.clockScope}>
              {health?.environment === 'local' ? 'this local server' : 'production'} · all agents
            </span>
          </div>
          <div className={styles.clockSub}>
            {on
              ? <>Last check {relative(health?.lastClaimedAt ?? null)} · watching {watching} agent{watching === 1 ? '' : 's'}</>
              : <>Nothing runs on its own while this is off. The test buttons still work.</>}
          </div>
        </div>
      </div>

      <div className={styles.clockActions}>
        <label className={styles.clockField}>
          <span className={styles.clockFieldLabel}>Every</span>
          <select
            className={styles.clockSelect}
            disabled={busy || !health}
            value={health?.intervalSeconds ?? 60}
            onChange={e => void patch(() => updateClockSettings(agentSlug, { intervalSeconds: Number(e.target.value) }))}
          >
            {(health?.intervalChoices ?? [60]).map(sec => (
              <option key={sec} value={sec}>{intervalLabel(sec)}</option>
            ))}
          </select>
        </label>

        <label className={styles.clockField} title="Which version of each agent the clock reads triggers from">
          <span className={styles.clockFieldLabel}>Reads</span>
          <select
            className={styles.clockSelect}
            disabled={busy || !health}
            value={health?.mode ?? 'published'}
            onChange={e => void patch(() => updateClockSettings(agentSlug, { mode: e.target.value as 'published' | 'active' }))}
          >
            <option value="published">Published</option>
            <option value="active">Active</option>
          </select>
        </label>

        {/* Same shape as Every and Reads — a small label and one
            control — so the strip stays a single row of equal-height
            things. The two verbs are joined into one segmented control
            because they are two answers to one question ("do it on this
            chat"), not two unrelated buttons.

            The label carries the scope, which is why the buttons can be
            bare verbs. It does NOT change when no chat is open: a label
            that swaps between two lengths made the whole strip jump. */}
        <span className={styles.clockField}
          title={previewConversationId === null
            ? 'Start or open a chat in the builder chat panel first. These only ever act on that one chat.'
            : 'These act on the chat open beside this screen, and on nothing else.'}>
          <span className={styles.clockFieldLabel}>On this chat</span>
          <span className={styles.segment}>
            <button className={styles.segBtn} disabled={busy || previewConversationId === null}
              onClick={() => void roundOnConversation('simulate')}
              title={previewConversationId === null
                ? 'Start or open a chat in the builder chat panel first.'
                : 'Ask every trigger on this agent whether the open chat is due right now, and show the numbers. Nothing runs and nothing is sent.'}>
              Check
            </button>
            <button className={styles.segBtn} disabled={busy || previewConversationId === null}
              onClick={() => void roundOnConversation('force')}
              title={previewConversationId === null
                ? 'Start or open a chat in the builder chat panel first.'
                : 'Run every trigger on this agent against the open chat now, even the ones that are not due yet. Real runs: they use up attempts and appear in Admin.'}>
              Run all
            </button>
          </span>
        </span>
        <button className={styles.iconRefresh} disabled={busy} onClick={() => { void load(); onTickedRef.current?.(); }}
          title="Refresh now — 'last check' is when a tick last ran, and it only updates on its own while the clock is running">
          ⟳
        </button>
        <button className={on ? styles.pauseBtn : styles.startBtn} disabled={busy || !health}
          onClick={() => void patch(() => setClockEnabled(agentSlug, !on))}>
          {on ? 'Pause' : 'Start clock'}
        </button>
      </div>

      {(lastRun || error || health?.modeHint || health?.precisionNote) && (
        <div className={styles.clockFoot}>
          {error && <span className={styles.errText}>{error}</span>}
          {!error && lastRun && <span>{lastRun}</span>}
          {/* A zero that explains itself. "Watching 0 agents" with no
              reason is what sent somebody hunting through the code. */}
          {!error && !lastRun && health?.modeHint && (
            <span className={styles.warnText}>{health.modeHint}</span>
          )}
          {!error && !lastRun && !health?.modeHint && (
            <span className={styles.mutedText}>{health?.precisionNote}</span>
          )}
        </div>
      )}
    </div>
  );
}
