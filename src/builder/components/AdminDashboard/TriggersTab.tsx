/**
 * TriggersTab — the operator's view of proactive messaging.
 *
 * Route: `/:agent/builder/admin/triggers`. See
 * aspect-agent-server/docs/guides/BUILDER_V2_TRIGGERS.md.
 *
 * A different job from the Triggers *screen*:
 *
 *   The screen  — "what should this agent do?"  (authoring)
 *   This tab    — "what HAS it been doing?"     (every rule at once,
 *                 and the switch that stops it)
 *
 * The feed is agent-wide rather than per-rule because one trigger
 * firing far more than expected only stands out when they sit side by
 * side. The clock control is repeated here rather than linked to: the
 * moment you notice something wrong is the moment you need to stop it.
 *
 * Layout follows the other admin tabs — white panels on the grey
 * ground, `#e5e7eb` hairlines, 13px/600 panel titles, and a bounded
 * content column so the page doesn't stretch to the window edge.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockBar } from '../TriggersScreen/ClockBar';
import { TriggersGuideModal } from '../TriggersGuide';
import {
  fetchAgentTriggerEvents,
  fetchTriggerStatus,
  type TriggerEventRow,
  type TriggerStatusRow,
} from '../../state/triggersApi';
import { useBuilder } from '../../state/BuilderContext';
import styles from './TriggersTab.module.css';

interface Props { agentSlug: string }

const OUTCOME: Record<string, { label: string; cls: string }> = {
  spoke:       { label: 'sent a message',          cls: 'spoke' },
  silent:      { label: 'stayed quiet',            cls: 'silent' },
  filtered:    { label: 'blocked by conditions',   cls: 'filtered' },
  quiet_hours: { label: 'held — quiet hours',      cls: 'quiet' },
  error:       { label: 'failed',                  cls: 'error' },
};

function relative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function statusLine(t: { enabled: boolean }, s: TriggerStatusRow | null): string {
  if (!t.enabled) return 'Not watching';
  if (!s?.lastEvaluatedAt) return 'On — not checked yet';
  if (s.lastResult === 'error') return `Last check failed — ${s.lastError || 'unknown error'}`;
  if (s.lastResult === 'matched') {
    return `Checked ${relative(s.lastEvaluatedAt)} · ${s.lastMatched} matched · last fired ${relative(s.lastFiredAt)}`;
  }
  const n = s.consecutiveEmpty;
  const why = s.lastReason || 'nobody was quiet enough';
  return `Checked ${relative(s.lastEvaluatedAt)} · ${why}${n > 1 ? ` (${n} checks in a row)` : ''}`;
}

export function TriggersTab({ agentSlug }: Props) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.slug === agentSlug) || doc.agents[0];
  const triggers = agent?.triggers?.triggers ?? [];

  const [events, setEvents] = useState<TriggerEventRow[]>([]);
  const [status, setStatus] = useState<Record<string, TriggerStatusRow>>({});
  const [filter, setFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const reload = useCallback(() => setNonce(n => n + 1), []);

  // Fetch in an async continuation, deduped by key — React 19's
  // StrictMode double-invokes effects, and the naive cancelled-flag form
  // can leave a panel stuck on its first render.
  const inFlight = useRef<string | null>(null);
  useEffect(() => {
    if (!agentSlug) return;
    const key = `${agentSlug}:${nonce}`;
    if (inFlight.current === key) return;
    inFlight.current = key;
    (async () => {
      try {
        const [ev, st] = await Promise.all([
          fetchAgentTriggerEvents(agentSlug, 200),
          fetchTriggerStatus(agentSlug),
        ]);
        setEvents(ev.events || []);
        setStatus(st.status || {});
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [agentSlug, nonce]);

  const nameOf = (triggerId: string) => {
    const t = triggers.find(x => x.id === triggerId);
    return t?.name || t?.typeId || 'Deleted trigger';
  };

  const shown = filter === 'all' ? events : events.filter(e => e.outcome === filter);
  const counts = events.reduce<Record<string, number>>((acc, e) => {
    if (e.outcome) acc[e.outcome] = (acc[e.outcome] || 0) + 1;
    return acc;
  }, {});
  const spoke = counts.spoke || 0;

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadText}>
          <h2 className={styles.h2}>Triggers</h2>
          <p className={styles.sub}>
            What this agent has said to people without being spoken to.
            {' '}Set the rules up on the{' '}
            <a className={styles.link} href={`/${agentSlug}/builder/triggers`}>Triggers screen</a>.
          </p>
        </div>
        <div className={styles.headActions}>
          {/* The outcome words on this page — "stayed quiet", "held",
              "blocked by conditions" — only mean something once you know
              what a trigger does between matching and speaking. */}
          <button type="button" className={styles.guideBtn} onClick={() => setGuideOpen(true)}
                  title="What triggers are, how the clock works, and what each outcome means">
            <span aria-hidden>📖</span> How triggers work
          </button>
          <button type="button" className={styles.refresh} onClick={reload}>Refresh</button>
        </div>
      </header>

      <TriggersGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      {error && <div className={styles.error}>{error}</div>}

      <ClockBar agentSlug={agentSlug} onTicked={reload} />

      {/* ── Rules ── */}
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>Rules on this agent</span>
          <span className={styles.count}>{triggers.length}</span>
        </div>

        {triggers.length === 0 ? (
          <div className={styles.empty}>
            None yet. Nothing can fire until a rule exists, is switched on, and the clock is running.
          </div>
        ) : (
          <ul className={styles.rules}>
            {triggers.map(t => (
              <li key={t.id} className={styles.rule}>
                <span className={t.enabled ? styles.dotOn : styles.dotOff} aria-hidden />
                <span className={styles.ruleName}>{t.name || t.typeId || 'Untitled trigger'}</span>
                <span className={styles.ruleMeta}>{statusLine(t, status[t.id] || null)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Activity. Non-sending outcomes are in this list on purpose:
             "it fired 40 times last night and said nothing every time"
             is a bug you can only see if the quiet outcomes show. ── */}
      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>Recent activity</span>
          <span className={styles.count}>{events.length}</span>
          {events.length > 0 && (
            <span className={styles.panelNote}>
              {spoke === 0
                ? 'nothing sent — every attempt stopped before a message'
                : `${spoke} message${spoke === 1 ? '' : 's'} sent`}
            </span>
          )}
        </div>

        {events.length > 0 && (
          <div className={styles.chips}>
            <button type="button"
              className={filter === 'all' ? styles.chipOn : styles.chip}
              onClick={() => setFilter('all')}>
              All <span className={styles.chipNum}>{events.length}</span>
            </button>
            {Object.entries(OUTCOME).map(([key, o]) => counts[key] ? (
              <button key={key} type="button"
                className={filter === key ? styles.chipOn : styles.chip}
                onClick={() => setFilter(key)}>
                {o.label} <span className={styles.chipNum}>{counts[key]}</span>
              </button>
            ) : null)}
          </div>
        )}

        {shown.length === 0 ? (
          <div className={styles.empty}>
            {events.length === 0
              ? 'Nothing yet — no trigger has acted on a conversation.'
              : 'Nothing with that outcome.'}
          </div>
        ) : (
          <ul className={styles.feed}>
            {shown.map(ev => {
              const o = OUTCOME[ev.outcome || ''] || { label: ev.status, cls: 'silent' };
              return (
                <li key={ev.id} className={styles.event}>
                  <span className={`${styles.badge} ${styles[o.cls]}`}>{o.label}</span>
                  <a className={styles.conv}
                     href={`/${agentSlug}/builder/admin/conversations?c=${ev.conversationId}`}>
                    #{ev.conversationId}
                  </a>
                  <span className={styles.evName}>{nameOf(ev.triggerId)}</span>
                  <span className={styles.evReason}>{ev.matchReason}</span>
                  <span className={styles.evWhen} title={new Date(ev.matchedAt).toLocaleString()}>
                    {relative(ev.matchedAt)}
                  </span>
                  {(ev.filterResult?.length || ev.error || ev.briefUsed) && (
                    <details className={styles.detail}>
                      <summary>details</summary>
                      {ev.error && <div className={styles.error}>{ev.error}</div>}
                      {ev.briefUsed && (
                        <p className={styles.brief}>
                          <strong>The crew was told:</strong> {ev.briefUsed}
                        </p>
                      )}
                      {ev.filterResult?.length ? (
                        <ul className={styles.clauses}>
                          {ev.filterResult.map((c, i) => (
                            <li key={i} className={c.ok ? styles.ok : styles.no}>
                              {c.ok ? '✓' : '✗'} {c.why}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
