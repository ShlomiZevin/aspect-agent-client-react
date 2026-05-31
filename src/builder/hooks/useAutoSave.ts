/**
 * useAutoSave — commit-driven background save.
 *
 * Mounted once at the BuilderApp root. Unlike the early Phase-A
 * version, this hook does NOT save on every keystroke. The dirty
 * state of the doc accumulates as the user edits; saves fire only on
 * explicit "I'm done" signals:
 *
 *   1. Sidebar selection change — the user navigated to a different
 *      crew / agent, so whatever they had open is "done with".
 *   2. Window or tab loses focus — they've switched apps or are about
 *      to leave the page.
 *   3. `beforeunload` — last-chance flush before the tab closes.
 *
 * In-modal "Done" buttons (e.g. AddonModal) call `saveCrewVersion`
 * themselves; this hook just covers the unstructured inline edits
 * (persona textarea, agent name, etc.).
 *
 * Behaviour:
 *   - Disabled when `settings.autoSave` is false → no-op.
 *   - Disabled while a pending Alfred Apply is unresolved — auto-save
 *     would silently log Alfred's targets without the user attributing
 *     them through the Save flow.
 */

import { useEffect, useRef } from 'react';
import { useBuilder } from '../state/BuilderContext';
import { useBuilderSettings } from '../components/TopBar/BuilderSettings';
import type { ID } from '../types';

export function useAutoSave() {
  const [settings] = useBuilderSettings();
  const {
    doc,
    selection,
    pendingAlfredApply,
    isAgentDirty,
    isCrewDirty,
    saveAgentVersion,
    saveCrewVersion,
  } = useBuilder();

  // Refs so the commit handlers always see the latest values without
  // having to re-bind event listeners on every doc change.
  const docRef                = useRef(doc);
  const isAgentDirtyRef       = useRef(isAgentDirty);
  const isCrewDirtyRef        = useRef(isCrewDirty);
  const saveAgentVersionRef   = useRef(saveAgentVersion);
  const saveCrewVersionRef    = useRef(saveCrewVersion);
  const pendingAlfredApplyRef = useRef(pendingAlfredApply);
  const enabledRef            = useRef(settings.autoSave);

  docRef.current                = doc;
  isAgentDirtyRef.current       = isAgentDirty;
  isCrewDirtyRef.current        = isCrewDirty;
  saveAgentVersionRef.current   = saveAgentVersion;
  saveCrewVersionRef.current    = saveCrewVersion;
  pendingAlfredApplyRef.current = pendingAlfredApply;
  enabledRef.current            = settings.autoSave;

  const flushNow = () => {
    if (!enabledRef.current) return;
    if (pendingAlfredApplyRef.current) return;
    const d = docRef.current;
    for (const agent of d.agents) {
      try {
        if (isAgentDirtyRef.current(agent.id)) saveAgentVersionRef.current(agent.id);
      } catch (err) {
        console.error('[builder] auto-save agent failed:', err);
      }
      for (const crew of agent.crews) {
        try {
          if (isCrewDirtyRef.current(agent.id, crew.id)) {
            saveCrewVersionRef.current(agent.id, crew.id);
          }
        } catch (err) {
          console.error('[builder] auto-save crew failed:', err);
        }
      }
    }
  };

  // ── Selection change ── any dirty entity flushed before the user
  // moves on. The selection itself doesn't drive the save — we just
  // notice that it changed and treat that as a commit signal.
  const prevSelectionKey = useRef<string>(`${selection.level}|${selection.agentId ?? ''}|${selection.crewId ?? ''}`);
  useEffect(() => {
    const key = `${selection.level}|${selection.agentId ?? ''}|${selection.crewId ?? ''}`;
    if (key !== prevSelectionKey.current) {
      prevSelectionKey.current = key;
      flushNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.level, selection.agentId, selection.crewId]);

  // ── Tab / window blur and unload listeners ──
  useEffect(() => {
    const onBlur     = () => flushNow();
    const onHidden   = () => { if (document.visibilityState === 'hidden') flushNow(); };
    const onUnload   = () => flushNow();
    window.addEventListener('blur',           onBlur);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload',   onUnload);
    return () => {
      window.removeEventListener('blur',           onBlur);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload',   onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
