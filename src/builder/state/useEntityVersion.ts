/**
 * Entity-version hooks — produce the props blob for the generic
 * VersionPill / VersionMenu components from either a crew or an
 * agent. Keeps the version UI agnostic of which level it's editing.
 *
 * Cross-entity dirty handling: a single user action can mutate both
 * the agent body AND a crew body (e.g. adding an agent-scoped field
 * from a crew view also touches an extractor in that crew). To avoid
 * forcing the user to click Save twice, `save()` here saves whatever
 * is dirty across both — and the `crossDirtyLabel` describes what
 * else got swept in so the button can display it.
 */

import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import type { ID, VersionMeta } from '../types';

export interface EntityVersionState {
  /** What `entityLabel` to show in the Save As modal title. */
  entityLabel: 'crew' | 'agent';
  versions: VersionMeta[];
  viewingVersionId: ID;
  activeVersionId: ID;
  /** True if EITHER this entity OR a related entity is dirty —
   *  drives the "Save" button enabled state. */
  isDirty: boolean;
  /** True specifically for the *primary* entity (this crew / this agent).
   *  Used by surfaces that care about the local-only state, like the
   *  Sidebar's version pill. */
  ownDirty: boolean;
  /**
   * If non-empty, the user-facing description of what else `save()`
   * will save besides the primary entity. Examples: "agent" (when a
   * crew save also persists the agent) or "2 crews" (when an agent
   * save also persists dirty crews). Empty string when only the
   * primary entity is dirty.
   */
  crossDirtyLabel: string;
  /** Next version number for Save As ("Save as v4"). */
  nextNumber: number;

  save: () => void;
  saveAs: (description?: string) => void;
  setViewing: (versionId: ID) => void;
  setActive: (versionId: ID) => void;
}

export function useCrewVersion(agentId: ID, crewId: ID): EntityVersionState | null {
  const {
    doc,
    saveCrewVersion,
    saveCrewVersionAs,
    setViewingCrewVersion,
    setActiveCrewVersion,
    saveAgentVersion,
    isCrewDirty,
    isAgentDirty,
  } = useBuilder();

  const crew = useMemo(
    () => doc.agents.find(a => a.id === agentId)?.crews.find(c => c.id === crewId),
    [doc, agentId, crewId],
  );

  if (!crew) return null;

  const crewDirty  = isCrewDirty(agentId, crewId);
  const agentDirty = isAgentDirty(agentId);

  const nextNumber =
    crew.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;

  return {
    entityLabel: 'crew',
    versions: crew.versions,
    viewingVersionId: crew.viewingVersionId,
    activeVersionId: crew.activeVersionId,
    isDirty:   crewDirty || agentDirty,
    ownDirty:  crewDirty,
    crossDirtyLabel: agentDirty ? 'agent' : '',
    nextNumber,
    save: () => {
      // Order doesn't matter — both saves are idempotent. Saving
      // both in one click is the point of the cross-dirty handling.
      if (crewDirty)  saveCrewVersion(agentId, crewId);
      if (agentDirty) saveAgentVersion(agentId);
    },
    saveAs:      d  => { saveCrewVersionAs(agentId, crewId, d); },
    setViewing:  id => setViewingCrewVersion(agentId, crewId, id),
    setActive:   id => setActiveCrewVersion(agentId, crewId, id),
  };
}

export function useAgentVersion(agentId: ID): EntityVersionState | null {
  const {
    doc,
    saveAgentVersion,
    saveAgentVersionAs,
    setViewingAgentVersion,
    setActiveAgentVersion,
    saveCrewVersion,
    isAgentDirty,
    isCrewDirty,
  } = useBuilder();

  const agent = useMemo(
    () => doc.agents.find(a => a.id === agentId),
    [doc, agentId],
  );

  if (!agent) return null;

  const agentDirty = isAgentDirty(agentId);
  // Which crews of this agent are dirty? An agent-level edit (e.g.
  // adding an agent field, then ticking an extractor that lives in
  // a crew) leaves those crews dirty too.
  const dirtyCrewIds = useMemoDirtyCrews(agent.crews.map(c => c.id), id => isCrewDirty(agentId, id));

  const nextNumber =
    agent.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;

  const crewLabel =
    dirtyCrewIds.length === 0 ? '' :
    dirtyCrewIds.length === 1 ? '1 crew'  :
    `${dirtyCrewIds.length} crews`;

  return {
    entityLabel: 'agent',
    versions: agent.versions,
    viewingVersionId: agent.viewingVersionId,
    activeVersionId: agent.activeVersionId,
    isDirty:   agentDirty || dirtyCrewIds.length > 0,
    ownDirty:  agentDirty,
    crossDirtyLabel: crewLabel,
    nextNumber,
    save: () => {
      if (agentDirty) saveAgentVersion(agentId);
      for (const id of dirtyCrewIds) saveCrewVersion(agentId, id);
    },
    saveAs:      d  => { saveAgentVersionAs(agentId, d); },
    setViewing:  id => setViewingAgentVersion(agentId, id),
    setActive:   id => setActiveAgentVersion(agentId, id),
  };
}

/** Tiny helper: memoised stable list of crew ids that are dirty. */
function useMemoDirtyCrews(crewIds: ID[], isDirty: (id: ID) => boolean): ID[] {
  // Inline-tag the dirty state so useMemo re-runs only when it changes.
  const tag = crewIds.map(id => `${id}:${isDirty(id) ? '1' : '0'}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => crewIds.filter(id => isDirty(id)), [tag]);
}
