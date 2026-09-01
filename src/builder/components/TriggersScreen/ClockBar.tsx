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
 * While it's running this polls, so both hosting screens refresh on
 * their own as fires land. It stops polling the moment the clock is
 * paused or the tab is hidden: a paused clock produces nothing to see,
 * and a background tab has nobody looking.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchClockHealth, setClockEnabled, updateClockSettings, stepClock,
  type ClockHealth,
} from '../../state/triggersApi';
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

  const step = async (dryRun: boolean) => {
    setBusy(true);
    setLastRun(null);
    try {
      const r = await stepClock(agentSlug, dryRun);
      setLastRun(
        r.skipped
          ? r.skipped
          : dryRun
            ? `Dry run: checked ${r.agents} agent${r.agents === 1 ? '' : 's'}, nothing sent.`
            : `Checked ${r.agents} agent${r.agents === 1 ? '' : 's'} · ${r.fired} message${r.fired === 1 ? '' : 's'} sent · ${r.durationMs}ms`,
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
              : <>Nothing fires on its own while this is off. Step once and Dry run still work.</>}
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

        <button className={styles.ghostBtn} disabled={busy} onClick={() => void step(true)}
          title="Check who would be nudged right now, and send nothing">
          Dry run
        </button>
        <button className={styles.ghostBtn} disabled={busy} onClick={() => void step(false)}
          title="Run one check now, even while paused">
          Step once
        </button>
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
