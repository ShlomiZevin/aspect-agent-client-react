/**
 * Entity-version hooks — produce the props blob for the generic
 * VersionPill / VersionMenu components from either a crew or an
 * agent. Keeps the version UI agnostic of which level it's editing.
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
  isDirty: boolean;
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
    isCrewDirty,
  } = useBuilder();

  const crew = useMemo(
    () => doc.agents.find(a => a.id === agentId)?.crews.find(c => c.id === crewId),
    [doc, agentId, crewId],
  );

  if (!crew) return null;

  const nextNumber =
    crew.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;

  return {
    entityLabel: 'crew',
    versions: crew.versions,
    viewingVersionId: crew.viewingVersionId,
    activeVersionId: crew.activeVersionId,
    isDirty: isCrewDirty(agentId, crewId),
    nextNumber,
    save:        () => saveCrewVersion(agentId, crewId),
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
    isAgentDirty,
  } = useBuilder();

  const agent = useMemo(
    () => doc.agents.find(a => a.id === agentId),
    [doc, agentId],
  );

  if (!agent) return null;

  const nextNumber =
    agent.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;

  return {
    entityLabel: 'agent',
    versions: agent.versions,
    viewingVersionId: agent.viewingVersionId,
    activeVersionId: agent.activeVersionId,
    isDirty: isAgentDirty(agentId),
    nextNumber,
    save:        () => saveAgentVersion(agentId),
    saveAs:      d  => { saveAgentVersionAs(agentId, d); },
    setViewing:  id => setViewingAgentVersion(agentId, id),
    setActive:   id => setActiveAgentVersion(agentId, id),
  };
}
