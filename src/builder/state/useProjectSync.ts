/**
 * useProjectSync — bridges the local `BuilderContext` to the
 * server-side persistence at `/api/builder/*`. Provides imperative
 * `pushXxx` helpers that the BuilderContext mutations call after
 * they update local state. Each helper maps to one surgical endpoint.
 *
 * Loading is handled by BuilderApp before BuilderProvider mounts —
 * the loaded doc is passed in as `initialDoc`. That keeps render 1
 * consistent: selection, draft persistence, and every other piece of
 * state initialized from `doc` see the real shape, not a placeholder.
 *
 * Notes:
 *   - Client generates all IDs (matches `uid()`). Server stores
 *     what it's sent.
 *   - Errors are surfaced to the console for now. UI surfacing
 *     comes in a follow-up.
 */

import * as api from './builderApi';
import type {
  AgentBody,
  AgentDoc,
  CrewBody,
  CrewDoc,
  ID,
} from '../types';

/**
 * Build the version-body slice of an AgentDoc. Exported so the
 * runtime-preview path can ship the *working copy* of the body
 * alongside a chat request — the server then runs the dirty version
 * instead of the saved one. Kept in lockstep with the snapshot the
 * save path produces (same shape, same field order).
 */
export function bodyOfAgent(agent: AgentDoc): AgentBody {
  return {
    name: agent.name,
    slug: agent.slug,
    spec: agent.spec,
    persona: agent.persona,
    defaultCrewId: agent.defaultCrewId,
    fields: agent.fields,
    domains: agent.domains ?? [],
    parameters: agent.parameters ?? [],
    enums: agent.enums ?? [],
    cortex: agent.cortex ?? [],
    snippets: agent.snippets ?? [],
  };
}

/** Mirror of `bodyOfAgent` for crews. Same exported-for-runtime-preview reason. */
export function bodyOfCrew(crew: CrewDoc): CrewBody {
  return {
    name: crew.name,
    description: crew.description,
    spec: crew.spec,
    persona: crew.persona,
    addons: crew.addons,
    fields: crew.fields,
  };
}

export interface ProjectSyncApi {
  pushSaveAgentVersion: (agent: AgentDoc) => Promise<void>;
  pushSaveAgentVersionAs: (agent: AgentDoc, description?: string) => Promise<void>;
  pushSetAgentActive: (agentId: ID, versionId: ID) => Promise<void>;
  pushSetAgentViewing: (agentId: ID, versionId: ID) => Promise<void>;
  /** Throws when the server refuses (last/active/viewing) — caller
   *  should NOT mutate local state until this resolves. */
  pushDeleteAgentVersion: (agentId: ID, versionId: ID) => Promise<void>;

  pushCreateCrew: (agentId: ID, crew: CrewDoc) => Promise<void>;
  pushDeleteCrew: (crewId: ID) => Promise<void>;
  pushSaveCrewVersion: (crew: CrewDoc) => Promise<void>;
  pushSaveCrewVersionAs: (crew: CrewDoc, description?: string) => Promise<void>;
  pushSetCrewActive: (crewId: ID, versionId: ID) => Promise<void>;
  pushSetCrewViewing: (crewId: ID, versionId: ID) => Promise<void>;
  /** Same throw-on-refuse contract as the agent variant. */
  pushDeleteCrewVersion: (crewId: ID, versionId: ID) => Promise<void>;
}

/**
 * Returns push helpers the caller wires into BuilderContext mutations.
 * Loading is owned by BuilderApp; this hook is push-only.
 */
export function useProjectSync(_args: {
  agentSlug: string;
  ownerUserId: string;
}): ProjectSyncApi {
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
    pushDeleteAgentVersion: (id, vId) => api.deleteAgentVersionApi(id, vId),

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
    pushDeleteCrewVersion: (id, vId) => api.deleteCrewVersionApi(id, vId),
  };
}
