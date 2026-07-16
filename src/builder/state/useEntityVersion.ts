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
  /** True when THIS entity has unsaved changes — drives the "Save"
   *  button enabled state. Each entity is self-contained: a dirty crew
   *  never makes its agent dirty, or vice versa. Equal to `ownDirty`. */
  isDirty: boolean;
  /** Same as `isDirty` — the entity's own local dirty state. Kept as a
   *  distinct field for the surfaces (Sidebar pill, VersionPill dot)
   *  that read it explicitly. */
  ownDirty: boolean;
  /**
   * Deprecated: always empty. Saves are now per-entity (a crew save
   * never also persists the agent, and vice versa), so there is nothing
   * cross-entity to announce. Retained so consumers compile unchanged;
   * the "+ N crew" Save suffix simply never renders.
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

  // ── Read-only preview (browse a non-active version) ──
  /** The version being previewed read-only for THIS entity, or null. */
  previewVersionId: ID | null;
  /** Whether the active line had unsaved edits when preview began —
   *  drives the Edit-this-version Save/Discard guard. */
  previewStashDirty: boolean;
  /** Enter a read-only preview of a version for this entity. */
  enterPreview: (versionId: ID) => void;
  /** Leave preview back to the editable line ("Back to active"). */
  exitPreview: () => void;
  /** Make the previewed version this entity's editable line. */
  editThisVersion: () => void;
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
    previewVersion,
    enterPreview: ctxEnterPreview,
    exitPreview,
    editThisVersion,
    discardCrewChanges,
    deleteCrewVersion,
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
    // Each entity's Save reflects and persists ONLY its own changes.
    // Editing a crew is the crew's business; it never marks the agent
    // dirty or saves it as a side effect (and vice versa). Use the
    // agent-level "Save all as…" to snapshot everything at once.
    isDirty:   crewDirty,
    ownDirty:  crewDirty,
    crossDirtyLabel: '',
    nextNumber,
    hasPendingAlfred,
    save: (opts) => {
      if (crewDirty) saveCrewVersion(agentId, crewId, opts);
    },
    saveAs:      (d, opts)  => { saveCrewVersionAs(agentId, crewId, d, opts); },
    setViewing:  id => setViewingCrewVersion(agentId, crewId, id),
    setActive:   id => setActiveCrewVersion(agentId, crewId, id),
    setPublished: id => setPublishedCrewVersion(agentId, crewId, id),
    previewVersionId:
      previewVersion && previewVersion.agentId === agentId && previewVersion.crewId === crewId
        ? previewVersion.versionId
        : null,
    previewStashDirty:
      previewVersion && previewVersion.agentId === agentId && previewVersion.crewId === crewId
        ? previewVersion.stashDirty
        : false,
    enterPreview: id => ctxEnterPreview(agentId, crewId, id, crewDirty),
    exitPreview,
    editThisVersion,
    discard:     () => {
      if (crewDirty) discardCrewChanges(agentId, crewId);
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
    previewVersion,
    enterPreview: ctxEnterPreview,
    exitPreview,
    editThisVersion,
    discardAgentChanges,
    deleteAgentVersion,
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
    // The agent's Save reflects and persists ONLY the agent's own body.
    // A dirty crew under it no longer marks the agent dirty or gets
    // saved as a side effect — save each entity from its own view, or
    // use "Save all as…" for a synchronised snapshot across all.
    isDirty:   agentDirty,
    ownDirty:  agentDirty,
    crossDirtyLabel: '',
    nextNumber,
    hasPendingAlfred,
    save: (opts) => {
      if (agentDirty) saveAgentVersion(agentId, opts);
    },
    saveAs:      (d, opts)  => { saveAgentVersionAs(agentId, d, opts); },
    setViewing:  id => setViewingAgentVersion(agentId, id),
    setActive:   id => setActiveAgentVersion(agentId, id),
    setPublished: id => setPublishedAgentVersion(agentId, id),
    publishAll:  () => publishAllVersions(agentId),
    previewVersionId:
      previewVersion && previewVersion.agentId === agentId && previewVersion.crewId === null
        ? previewVersion.versionId
        : null,
    previewStashDirty:
      previewVersion && previewVersion.agentId === agentId && previewVersion.crewId === null
        ? previewVersion.stashDirty
        : false,
    enterPreview: id => ctxEnterPreview(agentId, null, id, agentDirty),
    exitPreview,
    editThisVersion,
    discard:     () => {
      if (agentDirty) discardAgentChanges(agentId);
    },
    deleteVersion: vId => deleteAgentVersion(agentId, vId),
  };
}

