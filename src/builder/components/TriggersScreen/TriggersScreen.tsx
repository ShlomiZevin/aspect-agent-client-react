/**
 * TriggersScreen — where you set up the agent acting on its own.
 *
 * Route: `/:agent/builder/triggers`. Agent-level, a sibling of the Live
 * Brain and Profiler screens; stored on `agent.triggers`. See
 * aspect-agent-server/docs/guides/BUILDER_V2_TRIGGERS.md.
 *
 * Presented like the Cortex — same card language, same add-modal — but
 * laid out as a row rather than a chain, because triggers are
 * independent of each other. There is no order and no flow between
 * them, so drawing arrows would state something untrue.
 *
 * Nothing here fires until two switches are on: the card's own toggle
 * and the system clock at the top. Both start off.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { getTriggerType } from '../../triggers';
import { ClockBar } from './ClockBar';
import { TriggerCard } from './TriggerCard';
import { TriggerEditor } from './TriggerEditor';
import { AddTriggerModal } from './AddTriggerModal';
import { TriggersGuideModal } from '../TriggersGuide';
import { fetchTriggerStatus, type TriggerStatusRow } from '../../state/triggersApi';
import type { AgentTrigger, ID } from '../../types';
import styles from './TriggersScreen.module.css';

function uid(prefix: string): ID {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function TriggersScreen() {
  const { doc, updateAgent } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const slug = agent?.slug;

  const [editingId, setEditingId] = useState<ID | null>(null);
  const [status, setStatus] = useState<Record<string, TriggerStatusRow>>({});
  const [picking, setPicking] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const def = agent?.triggers;
  const triggers = useMemo(() => def?.triggers ?? [], [def]);
  // Absent means on, so agents saved before this feature are unaffected.
  const allEnabled = def?.enabled !== false;

  // Bumped to re-pull the heartbeat after a manual tick or an edit.
  const [statusNonce, setStatusNonce] = useState(0);
  const loadStatus = useCallback(() => setStatusNonce(n => n + 1), []);

  // Fetch inside an async continuation (never a synchronous setState in
  // the effect body), deduped by key rather than a per-closure
  // `cancelled` flag — React 19's StrictMode double-invokes effects and
  // the naive version can leave the panel stuck on its first state.
  const inFlight = useRef<string | null>(null);
  useEffect(() => {
    if (!slug) return;
    const key = `${slug}:${statusNonce}`;
    if (inFlight.current === key) return;
    inFlight.current = key;
    (async () => {
      try {
        const r = await fetchTriggerStatus(slug);
        setStatus(r.status || {});
      } catch {
        /* Keep the last known heartbeat: a failed poll is not the same
           as "never checked", and showing the latter would be a lie. */
      }
    })();
  }, [slug, statusNonce]);

  if (!agent) return null;

  const writeTriggers = (next: AgentTrigger[]) =>
    updateAgent(agent.id, { triggers: { ...(def ?? {}), triggers: next } });

  const addTrigger = (typeId: string) => {
    const type = getTriggerType(typeId);
    if (!type) return;
    const next: AgentTrigger = {
      id: uid('trg'),
      name: type.displayName,
      typeId,
      // A brand-new trigger starts OFF. Enabling is the deliberate act,
      // and it is what stamps `activeSince` — which is what stops it
      // reaching back into conversations that went quiet before it
      // existed.
      enabled: false,
      activeSince: new Date().toISOString(),
      config: structuredClone(type.defaultConfig),
      run: { crewId: agent.defaultCrewId || agent.crews[0]?.id || '', brief: '' },
    };
    writeTriggers([...triggers, next]);
    setEditingId(next.id);
  };

  const patchTrigger = (id: ID, patch: Partial<AgentTrigger>) => {
    writeTriggers(triggers.map(t => {
      if (t.id !== id) return t;
      const merged = { ...t, ...patch };
      // Switching a trigger ON re-stamps `activeSince`. Otherwise a
      // trigger created weeks ago, then enabled today, would treat every
      // conversation that has gone quiet since as fair game and nudge
      // all of them at once on the first tick.
      if (patch.enabled === true && t.enabled !== true) {
        merged.activeSince = new Date().toISOString();
      }
      return merged;
    }));
  };

  const removeTrigger = async (t: AgentTrigger) => {
    const ok = await confirm({
      title: 'Delete this trigger?',
      message: `"${t.name}" will stop watching for anything. Messages it already sent stay in their conversations.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    writeTriggers(triggers.filter(x => x.id !== t.id));
    if (editingId === t.id) setEditingId(null);
  };

  const editing = triggers.find(t => t.id === editingId) || null;

  return (
    <div className={styles.screen}>
      <div className={styles.headRow}>
        <div>
          <h1 className={styles.h1}>Triggers</h1>
          <p className={styles.sub}>When the agent should say something without being spoken to.</p>
        </div>
        {/* Next to the master switch rather than tucked in a corner:
            this screen's own vocabulary ("quiet", "attempts", "reads
            active") is the thing a first-time author is missing, and
            the guide is where it is defined. */}
        <button
          type="button"
          className={styles.guideBtn}
          onClick={() => setGuideOpen(true)}
          title="What triggers are, how the clock works, and why one might not be firing"
        >
          <span aria-hidden>📖</span> How triggers work
        </button>
        <label className={styles.toggle} title="Turn every trigger on this agent on or off at once">
          <input
            type="checkbox"
            checked={allEnabled}
            onChange={() => updateAgent(agent.id, {
              triggers: { triggers: [], ...(def ?? {}), enabled: !allEnabled },
            })}
          />
          <span className={styles.switch} />
          <span className={styles.switchLabel}>{allEnabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {slug && <ClockBar agentSlug={slug} onTicked={loadStatus} />}

      <div className={styles.lane}>
        <div className={styles.laneHead}>
          <span className={styles.laneName}>Watching</span>
          <span className={styles.laneCount}>{triggers.length}</span>
        </div>

        <div className={styles.cards}>
          {triggers.map(t => (
            <TriggerCard
              key={t.id}
              agent={agent}
              trigger={t}
              status={status[t.id] || null}
              masterOn={allEnabled}
              onEdit={() => setEditingId(t.id)}
              onToggle={() => patchTrigger(t.id, { enabled: !t.enabled })}
            />
          ))}

          <button className={styles.addCard} onClick={() => setPicking(true)} title="Add a trigger">
            <span className={styles.addPlus}>+</span>
            <span className={styles.addLabel}>Add trigger</span>
          </button>
        </div>

        {triggers.length === 0 && (
          <p className={styles.laneEmpty}>
            A trigger watches this agent's conversations and starts a crew on the ones that
            match — no customer message involved.{' '}
            <button type="button" className={styles.emptyLink} onClick={() => setGuideOpen(true)}>
              Read how they work
            </button>
          </p>
        )}
      </div>

      <TriggersGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      {editing && (
        <TriggerEditor
          agent={agent}
          agentSlug={slug}
          onRan={loadStatus}
          trigger={editing}
          onChange={patch => patchTrigger(editing.id, patch)}
          onDelete={() => void removeTrigger(editing)}
          onClose={() => { setEditingId(null); loadStatus(); }}
        />
      )}

      <AddTriggerModal
        open={picking}
        onClose={() => setPicking(false)}
        onPick={addTrigger}
      />
    </div>
  );
}
