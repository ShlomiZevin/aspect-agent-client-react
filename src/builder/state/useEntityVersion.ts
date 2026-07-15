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
import { useBuilder, type SaveOpts } from './BuilderContext';
import type { ID, VersionMeta } from '../types';

export interface EntityVersionState {
  /** What `entityLabel` to show in the Save As modal title. */
  entityLabel: 'crew' | 'agent';
  versions: VersionMeta[];
  viewingVersionId: ID;
  activeVersionId: ID;
  /** Customer-facing published version, or null when nothing is
   *  published yet (runtime falls back to active→viewing). */
  publishedVersionId: ID | null;
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

  /**
   * True iff this entity (or one of the cross-entities `save()` would
   * touch) has a pending Alfred apply target. The VersionMenu uses
   * this to gate the Save-attribution chooser.
   */
  hasPendingAlfred: boolean;

  save: (opts?: SaveOpts) => void;
  saveAs: (description?: string, opts?: SaveOpts) => void;
  setViewing: (versionId: ID) => void;
  setActive: (versionId: ID) => void;
  /** Set the customer-facing published version. Pass `null` to unpublish. */
  setPublished: (versionId: ID | null) => void;
  /** Agent-only: publish the agent + every crew to their ACTIVE
   *  versions in one click. Undefined for crews. */
  publishAll?: () => void;
  /** Revert the working copy to the viewing version's body. Also
   *  drops any pending Alfred apply target for this entity. */
  discard: () => void;
  /** Permanently delete a snapshot version. Server rejects last /
   *  active / viewing; the thrown Error carries `code` so the UI
   *  can surface the reason. */
  deleteVersion: (versionId: ID) => Promise<void>;
}

export function useCrewVersion(agentId: ID, crewId: ID): EntityVersionState | null {
  const {
    doc,
    saveCrewVersion,
    saveCrewVersionAs,
    setViewingCrewVersion,
    setActiveCrewVersion,
    setPublishedCrewVersion,
    discardCrewChanges,
    discardAgentChanges,
    deleteCrewVersion,
    saveAgentVersion,
    isCrewDirty,
    isAgentDirty,
    pendingAlfredApply,
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

  const hasPendingAlfred = !!pendingAlfredApply?.targets.some(
    t => !t.applied && (
      (t.entity === 'crew' && t.entityId === crewId) ||
      (t.entity === 'agent' && t.entityId === agentId && agentDirty)
    ),
  );

  return {
    entityLabel: 'crew',
    versions: crew.versions,
    viewingVersionId: crew.viewingVersionId,
    activeVersionId: crew.activeVersionId,
    publishedVersionId: crew.publishedVersionId ?? null,
    isDirty:   crewDirty || agentDirty,
    ownDirty:  crewDirty,
    crossDirtyLabel: agentDirty ? 'agent' : '',
    nextNumber,
    hasPendingAlfred,
    save: (opts) => {
      // Order doesn't matter — both saves are idempotent. Saving
      // both in one click is the point of the cross-dirty handling.
      // Same attribution applies to both because it's one logical
      // commit; the user picked it once.
      if (crewDirty)  saveCrewVersion(agentId, crewId, opts);
      if (agentDirty) saveAgentVersion(agentId, opts);
    },
    saveAs:      (d, opts)  => { saveCrewVersionAs(agentId, crewId, d, opts); },
    setViewing:  id => setViewingCrewVersion(agentId, crewId, id),
    setActive:   id => setActiveCrewVersion(agentId, crewId, id),
    setPublished: id => setPublishedCrewVersion(agentId, crewId, id),
    // Match save's cross-entity scope — discarding only one side
    // when an action touched both would leave the user stranded
    // (e.g. agent has a new field def but the crew that wired it is
    // reverted, or vice versa).
    discard:     () => {
      if (crewDirty)  discardCrewChanges(agentId, crewId);
      if (agentDirty) discardAgentChanges(agentId);
    },
    deleteVersion: vId => deleteCrewVersion(agentId, crewId, vId),
  };
}

export function useAgentVersion(agentId: ID): EntityVersionState | null {
  const {
    doc,
    saveAgentVersion,
    saveAgentVersionAs,
    setViewingAgentVersion,
    setActiveAgentVersion,
    setPublishedAgentVersion,
    publishAllVersions,
    discardAgentChanges,
    discardCrewChanges,
    deleteAgentVersion,
    saveCrewVersion,
    isAgentDirty,
    isCrewDirty,
    pendingAlfredApply,
  } = useBuilder();

  const agent = useMemo(
    () => doc.agents.find(a => a.id === agentId),
    [doc, agentId],
  );

  if (!agent) return null;

  const agentDirty = isAgentDirty(agentId);
  const dirtyCrewIds = agent.crews.map(c => c.id).filter(id => isCrewDirty(agentId, id));

  const nextNumber =
    agent.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;

  const crewLabel =
    dirtyCrewIds.length === 0 ? '' :
    dirtyCrewIds.length === 1 ? '1 crew'  :
    `${dirtyCrewIds.length} crews`;

  const hasPendingAlfred = !!pendingAlfredApply?.targets.some(
    t => !t.applied && (
      (t.entity === 'agent' && t.entityId === agentId) ||
      (t.entity === 'crew' && dirtyCrewIds.includes(t.entityId))
    ),
  );

  return {
    entityLabel: 'agent',
    versions: agent.versions,
    viewingVersionId: agent.viewingVersionId,
    activeVersionId: agent.activeVersionId,
    publishedVersionId: agent.publishedVersionId ?? null,
    isDirty:   agentDirty || dirtyCrewIds.length > 0,
    ownDirty:  agentDirty,
    crossDirtyLabel: crewLabel,
    nextNumber,
    hasPendingAlfred,
    save: (opts) => {
      if (agentDirty) saveAgentVersion(agentId, opts);
      for (const id of dirtyCrewIds) saveCrewVersion(agentId, id, opts);
    },
    saveAs:      (d, opts)  => { saveAgentVersionAs(agentId, d, opts); },
    setViewing:  id => setViewingAgentVersion(agentId, id),
    setActive:   id => setActiveAgentVersion(agentId, id),
    setPublished: id => setPublishedAgentVersion(agentId, id),
    publishAll:  () => publishAllVersions(agentId),
    discard:     () => {
      if (agentDirty) discardAgentChanges(agentId);
      for (const id of dirtyCrewIds) discardCrewChanges(agentId, id);
    },
    deleteVersion: vId => deleteAgentVersion(agentId, vId),
  };
}

