/**
 * useAutoSave — debounced background save of every dirty entity.
 *
 * Mounted once at the BuilderApp root. Walks the working doc on every
 * change, and for each entity (the agent + each crew) whose working
 * copy diverges from its viewing version, schedules a single
 * "save into viewing version" call after a short idle.
 *
 * Behaviour:
 *   - Disabled when `settings.autoSave` is false → no-op.
 *   - Disabled while a pending Alfred Apply is unresolved — auto-save
 *     would silently log Alfred's targets without the user attributing
 *     them, which is exactly the wrong default.
 *   - Debounced per-entity: each entity has its own timer so editing
 *     crew A doesn't reset crew B's pending save.
 *   - Uses the *same* saveCrewVersion / saveAgentVersion mutations the
 *     manual button calls, so the server side is unchanged.
 */

import { useEffect, useRef } from 'react';
import { useBuilder } from '../state/BuilderContext';
import { useBuilderSettings } from '../components/TopBar/BuilderSettings';
import type { ID } from '../types';

const DEBOUNCE_MS = 800;

export function useAutoSave() {
  const [settings] = useBuilderSettings();
  const {
    doc,
    pendingAlfredApply,
    isAgentDirty,
    isCrewDirty,
    saveAgentVersion,
    saveCrewVersion,
  } = useBuilder();

  // Per-entity debounce timers. Keyed by "agent:<id>" / "crew:<aid>:<cid>".
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    if (!settings.autoSave) return;
    // Hold while Alfred has a pending apply — never overwrite his draft
    // without the user confirming attribution through the Save flow.
    if (pendingAlfredApply) return;

    const timers = timersRef.current;
    const schedule = (key: string, fn: () => void) => {
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(key, setTimeout(() => {
        timers.delete(key);
        try { fn(); } catch (err) { console.error('[builder] auto-save failed:', err); }
      }, DEBOUNCE_MS));
    };

    for (const agent of doc.agents) {
      const agentKey = `agent:${agent.id}`;
      if (isAgentDirty(agent.id)) {
        schedule(agentKey, () => saveAgentVersion(agent.id));
      }
      for (const crew of agent.crews) {
        const crewKey = `crew:${agent.id}:${crew.id}`;
        if (isCrewDirty(agent.id, crew.id)) {
          schedule(crewKey, () => saveCrewVersion(agent.id, crew.id));
        }
      }
    }

    return () => {
      // Component unmount or settings change — flush nothing, just
      // drop any pending timers so we don't fire after teardown.
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, [
    settings.autoSave,
    doc,
    pendingAlfredApply,
    isAgentDirty,
    isCrewDirty,
    saveAgentVersion,
    saveCrewVersion,
  ]);
}

/** Optional helper for status badges — gives callers a snapshot of
 *  "any entity in the working doc dirty?" without subscribing to
 *  each one individually. */
export function useAnyDirty(): { dirty: boolean; details: { agents: ID[]; crews: { agentId: ID; crewId: ID }[] } } {
  const { doc, isAgentDirty, isCrewDirty } = useBuilder();
  const agents: ID[] = [];
  const crews: { agentId: ID; crewId: ID }[] = [];
  for (const a of doc.agents) {
    if (isAgentDirty(a.id)) agents.push(a.id);
    for (const c of a.crews) {
      if (isCrewDirty(a.id, c.id)) crews.push({ agentId: a.id, crewId: c.id });
    }
  }
  return { dirty: agents.length > 0 || crews.length > 0, details: { agents, crews } };
}
