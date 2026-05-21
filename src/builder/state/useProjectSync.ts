/**
 * useProjectSync — bridges the local `BuilderContext` to the
 * server-side persistence at `/api/builder/*`.
 *
 * Responsibilities:
 *   1. On mount: fetch the project from the server for
 *      (agentSlug, ownerUserId). If 404, bootstrap a new one using
 *      the local empty doc shape.
 *   2. Provide imperative `pushXxx` helpers that the
 *      BuilderContext mutations call after they update local state.
 *      Each helper maps to one surgical endpoint.
 *
 * Notes:
 *   - Client generates all IDs (matches `uid()`). Server stores
 *     what it's sent.
 *   - Errors are surfaced to the console for now. UI surfacing
 *     comes in a follow-up.
 */

import { useEffect, useRef } from 'react';
import * as api from './builderApi';
import type {
  AgentBody,
  AgentDoc,
  CrewBody,
  CrewDoc,
  ID,
  ProjectDoc,
} from '../types';

function bodyOfAgent(agent: AgentDoc): AgentBody {
  return {
    name: agent.name,
    slug: agent.slug,
    spec: agent.spec,
    persona: agent.persona,
    defaultCrewId: agent.defaultCrewId,
  };
}

function bodyOfCrew(crew: CrewDoc): CrewBody {
  return {
    name: crew.name,
    description: crew.description,
    spec: crew.spec,
    persona: crew.persona,
    addons: crew.addons,
  };
}

export interface ProjectSyncApi {
  pushSaveAgentVersion: (agent: AgentDoc) => Promise<void>;
  pushSaveAgentVersionAs: (agent: AgentDoc, description?: string) => Promise<void>;
  pushSetAgentActive: (agentId: ID, versionId: ID) => Promise<void>;
  pushSetAgentViewing: (agentId: ID, versionId: ID) => Promise<void>;

  pushCreateCrew: (agentId: ID, crew: CrewDoc) => Promise<void>;
  pushDeleteCrew: (crewId: ID) => Promise<void>;
  pushSaveCrewVersion: (crew: CrewDoc) => Promise<void>;
  pushSaveCrewVersionAs: (crew: CrewDoc, description?: string) => Promise<void>;
  pushSetCrewActive: (crewId: ID, versionId: ID) => Promise<void>;
  pushSetCrewViewing: (crewId: ID, versionId: ID) => Promise<void>;
}

/**
 * Load (or bootstrap) the project for an agent slug. Calls
 * `onLoaded` with the hydrated doc. After that, returns push
 * helpers the caller can wire into BuilderContext mutations.
 */
export function useProjectSync(args: {
  agentSlug: string;
  ownerUserId: string;
  /** Local fallback used to bootstrap if the server has no doc yet. */
  fallbackDoc: ProjectDoc;
  onLoaded: (doc: ProjectDoc) => void;
}): ProjectSyncApi {
  const { agentSlug, ownerUserId, fallbackDoc, onLoaded } = args;
  const didLoadRef = useRef(false);

  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;
    (async () => {
      try {
        const existing = await api.fetchProject({ agentSlug, ownerUserId });
        if (existing) {
          onLoaded(existing);
          return;
        }
        // Bootstrap from the local fallback doc.
        const agent = fallbackDoc.agents[0];
        const crew = agent?.crews[0];
        if (!agent || !crew) {
          console.warn('[builder] fallback doc has no agent/crew; cannot bootstrap');
          return;
        }
        const bootstrapped = await api.bootstrapProject({
          ownerUserId,
          projectId:      fallbackDoc.id,
          projectName:    fallbackDoc.name,
          agentId:        agent.id,
          agentSlug:      agent.slug,
          agentVersionId: agent.versions[0]?.id || agent.activeVersionId,
          agentBody:      bodyOfAgent(agent),
          crewId:         crew.id,
          crewVersionId:  crew.versions[0]?.id || crew.activeVersionId,
          crewBody:       bodyOfCrew(crew),
        });
        onLoaded(bootstrapped);
      } catch (err) {
        console.error('[builder] useProjectSync load failed:', err);
      }
    })();
  }, [agentSlug, ownerUserId, fallbackDoc, onLoaded]);

  return {
    pushSaveAgentVersion: async agent => {
      try {
        await api.saveAgentVersionApi({
          agentId: agent.id,
          versionId: agent.viewingVersionId,
          body: bodyOfAgent(agent),
        });
      } catch (err) {
        console.error('[builder] saveAgentVersion failed:', err);
      }
    },
    pushSaveAgentVersionAs: async (agent, description) => {
      try {
        await api.saveAgentVersionAsApi({
          agentId: agent.id,
          versionId: agent.viewingVersionId,
          body: bodyOfAgent(agent),
          description,
        });
      } catch (err) {
        console.error('[builder] saveAgentVersionAs failed:', err);
      }
    },
    pushSetAgentActive:  (id, vId) => api.setAgentActiveApi(id, vId).catch(console.error),
    pushSetAgentViewing: (id, vId) => api.setAgentViewingApi(id, vId).catch(console.error),

    pushCreateCrew: async (agentId, crew) => {
      try {
        await api.createCrewApi({
          agentId,
          crewId: crew.id,
          versionId: crew.versions[0]?.id || crew.activeVersionId,
          body: bodyOfCrew(crew),
        });
      } catch (err) {
        console.error('[builder] createCrew failed:', err);
      }
    },
    pushDeleteCrew: id => api.deleteCrewApi(id).catch(console.error),
    pushSaveCrewVersion: async crew => {
      try {
        await api.saveCrewVersionApi({
          crewId: crew.id,
          versionId: crew.viewingVersionId,
          body: bodyOfCrew(crew),
        });
      } catch (err) {
        console.error('[builder] saveCrewVersion failed:', err);
      }
    },
    pushSaveCrewVersionAs: async (crew, description) => {
      try {
        await api.saveCrewVersionAsApi({
          crewId: crew.id,
          versionId: crew.viewingVersionId,
          body: bodyOfCrew(crew),
          description,
        });
      } catch (err) {
        console.error('[builder] saveCrewVersionAs failed:', err);
      }
    },
    pushSetCrewActive:  (id, vId) => api.setCrewActiveApi(id, vId).catch(console.error),
    pushSetCrewViewing: (id, vId) => api.setCrewViewingApi(id, vId).catch(console.error),
  };
}
