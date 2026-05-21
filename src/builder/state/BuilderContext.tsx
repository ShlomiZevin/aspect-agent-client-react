/**
 * BuilderContext — single source of truth for the current builder
 * session. Holds the in-progress `ProjectDoc`, the current selection
 * (project / agent / crew), and provides immutable update helpers so
 * components don't reach into nested arrays themselves.
 *
 * Persists every update to localStorage so an accidental refresh
 * doesn't lose the draft. Save-to-server lives outside this context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useProjectSync, type ProjectSyncApi } from './useProjectSync';
import type {
  AddonContext,
  AddonInstance,
  AgentBody,
  AgentDoc,
  AgentVersion,
  BuilderSelection,
  CrewBody,
  CrewDoc,
  CrewVersion,
  ID,
  OutputType,
  ProjectDoc,
  TalkerConfig,
} from '../types';
import { loadDraft, saveDraft } from './draftStorage';
import { talkerPlugin, TALKER_PLUGIN_ID } from '../plugins/talker/addon.talker';
import { defaultContextFor, defaultOutputTypeFor } from '../registry/plugins';

// ─── Factories ─────────────────────────────────────────────────────

function uid(prefix: string): ID {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function defaultTalker(): AddonInstance<TalkerConfig> {
  return {
    instanceId: uid('addon'),
    pluginId: TALKER_PLUGIN_ID,
    lane: talkerPlugin.defaultLane,
    enabled: true,
    config: talkerPlugin.defaultConfig(),
    context: defaultContextFor(talkerPlugin),
    outputType: defaultOutputTypeFor(talkerPlugin),
    promptTemplate: talkerPlugin.defaultPromptTemplate,
  };
}

function bodyOf(crew: CrewDoc): CrewBody {
  return {
    name: crew.name,
    description: crew.description,
    spec: crew.spec,
    persona: crew.persona,
    addons: crew.addons,
  };
}

function emptyCrew(name = 'Welcome'): CrewDoc {
  const initialBody: CrewBody = {
    name,
    description: '',
    spec: '',
    addons: [defaultTalker() as AddonInstance],
  };
  const versionId = uid('ver');
  const v1: CrewVersion = {
    id: versionId,
    number: 1,
    description: 'Initial',
    createdAt: new Date().toISOString(),
    body: initialBody,
  };
  return {
    id: uid('crew'),
    ...initialBody,
    versions: [v1],
    activeVersionId: versionId,
    viewingVersionId: versionId,
  };
}

/**
 * Stable JSON stringify — sorts object keys so two equal objects
 * produce the same string regardless of key insertion order. Needed
 * because Postgres `jsonb` doesn't preserve key order when round-
 * tripped, so the server-returned version body has keys in a
 * different order than what the client's `bodyOf*` returns even
 * when the values are identical.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map(k => [k, (v as Record<string, unknown>)[k]]),
      );
    }
    return v;
  });
}

/** Deep-ish equality good enough for CrewBody. Key-order-independent. */
function bodiesEqual(a: CrewBody, b: CrewBody): boolean {
  return stableStringify(a) === stableStringify(b);
}

function bodyOfAgent(agent: AgentDoc): AgentBody {
  return {
    name: agent.name,
    slug: agent.slug,
    spec: agent.spec,
    persona: agent.persona,
    defaultCrewId: agent.defaultCrewId,
  };
}

function agentBodiesEqual(a: AgentBody, b: AgentBody): boolean {
  return stableStringify(a) === stableStringify(b);
}

function emptyAgent(slug: string): AgentDoc {
  const crew = emptyCrew('Welcome');
  const initialBody: AgentBody = {
    name: slug,
    slug,
    spec: '',
    persona: '',
    defaultCrewId: crew.id,
  };
  const versionId = uid('ver');
  const v1: AgentVersion = {
    id: versionId,
    number: 1,
    description: 'Initial',
    createdAt: new Date().toISOString(),
    body: initialBody,
  };
  return {
    id: uid('agent'),
    ...initialBody,
    crews: [crew],
    versions: [v1],
    activeVersionId: versionId,
    viewingVersionId: versionId,
  };
}

function emptyProject(slug: string): ProjectDoc {
  return {
    id: uid('project'),
    name: slug,
    spec: '',
    agents: [emptyAgent(slug)],
  };
}

// ─── Context shape ────────────────────────────────────────────────

interface BuilderState {
  doc: ProjectDoc;
  selection: BuilderSelection;

  // Selection
  setSelection: (sel: BuilderSelection) => void;

  // Project-level
  updateProject: (patch: Partial<Pick<ProjectDoc, 'name' | 'spec'>>) => void;

  // Agent-level
  updateAgent: (
    agentId: ID,
    patch: Partial<Pick<AgentDoc, 'name' | 'spec' | 'persona' | 'defaultCrewId'>>,
  ) => void;

  // Crew CRUD + edit
  addCrew: (agentId: ID) => CrewDoc;
  removeCrew: (agentId: ID, crewId: ID) => void;
  updateCrew: (
    agentId: ID,
    crewId: ID,
    patch: Partial<Pick<CrewDoc, 'name' | 'description' | 'spec' | 'persona'>>,
  ) => void;

  // Addons inside a crew
  addAddon: (agentId: ID, crewId: ID, instance: AddonInstance) => void;
  updateAddonConfig: (
    agentId: ID,
    crewId: ID,
    instanceId: ID,
    nextConfig: unknown,
  ) => void;
  updateAddonContext: (
    agentId: ID,
    crewId: ID,
    instanceId: ID,
    nextContext: AddonContext,
  ) => void;
  setAddonOutputType: (
    agentId: ID,
    crewId: ID,
    instanceId: ID,
    nextType: OutputType,
  ) => void;
  setAddonEnabled: (
    agentId: ID,
    crewId: ID,
    instanceId: ID,
    enabled: boolean,
  ) => void;
  removeAddon: (agentId: ID, crewId: ID, instanceId: ID) => void;

  // Crew versioning
  /** Overwrite the *viewing* version's snapshot with the current working state. */
  saveCrewVersion: (agentId: ID, crewId: ID) => void;
  /** Create a new version from the current working state and start viewing it. Active stays where it was. */
  saveCrewVersionAs: (agentId: ID, crewId: ID, description?: string) => CrewVersion;
  /** Load a version's snapshot into the working state. Active stays where it was. */
  setViewingCrewVersion: (agentId: ID, crewId: ID, versionId: ID) => void;
  /** Flip the active-version pointer. Doesn't touch the working state. */
  setActiveCrewVersion: (agentId: ID, crewId: ID, versionId: ID) => void;
  /** True when the working state differs from the *viewing* version's snapshot. */
  isCrewDirty: (agentId: ID, crewId: ID) => boolean;

  // Agent versioning — same shape as crew.
  saveAgentVersion: (agentId: ID) => void;
  saveAgentVersionAs: (agentId: ID, description?: string) => AgentVersion;
  setViewingAgentVersion: (agentId: ID, versionId: ID) => void;
  setActiveAgentVersion: (agentId: ID, versionId: ID) => void;
  isAgentDirty: (agentId: ID) => boolean;

  // Reset (debug helper)
  resetDraft: () => void;

  // Preview conversation — the conversationId for the in-builder
  // "User Chat" panel. Exposed so prompt-preview views can fetch
  // the actual transcript for the history sidebar.
  previewConversationId: number | null;
  setPreviewConversationId: (id: number | null) => void;

  // Live builder memory for the preview conversation. Refetched
  // after every chat turn so the FieldsPanel can show current values.
  conversationMemory: Record<string, Record<string, unknown>>;
  refreshConversationMemory: () => void;
  /**
   * Edit / clear a single field value in the live conversation memory.
   * No-op when there's no active preview conversation. Returns true on
   * success.
   */
  updateConversationMemoryField: (args: {
    field: string;
    value?: unknown;
    domain?: string | null;
    clear?: boolean;
  }) => Promise<boolean>;
}

const BuilderCtx = createContext<BuilderState | null>(null);

// ─── Provider ──────────────────────────────────────────────────────

interface ProviderProps {
  agentSlug: string;
  /** localStorage dummy user id — same pattern as v1 today. */
  ownerUserId: string;
  children: ReactNode;
}

export function BuilderProvider({ agentSlug, ownerUserId, children }: ProviderProps) {
  const [doc, setDoc] = useState<ProjectDoc>(() => loadDraft(agentSlug) ?? emptyProject(agentSlug));

  // Mirror `doc` in a ref so mutations can compute the next state
  // synchronously from the current state, *before* calling setDoc.
  // Relying on closure capture inside a setDoc updater doesn't work
  // in React 18 — the updater isn't guaranteed to run before the
  // statement after setDoc(). Pattern:
  //
  //   const d = docRef.current;
  //   const next = compute(d);
  //   setDoc(next);
  //   syncRef.current?.pushXxx(next.agents[...]);
  //
  // Updated synchronously after every render via the effect below.
  const docRef = useRef<ProjectDoc>(doc);
  docRef.current = doc;

  // Bridge to server-side persistence. Loads (or bootstraps) the
  // doc on mount, then provides push helpers wired into the
  // mutations below.
  const sync: ProjectSyncApi = useProjectSync({
    agentSlug,
    ownerUserId,
    fallbackDoc: doc,
    onLoaded: setDoc,
  });
  const syncRef = useRef<ProjectSyncApi>(sync);
  syncRef.current = sync;


  // First agent is the implicit "current" agent during this session.
  const initialAgentId = doc.agents[0]?.id;
  const initialCrewId = doc.agents[0]?.defaultCrewId ?? doc.agents[0]?.crews[0]?.id;

  const [selection, setSelection] = useState<BuilderSelection>({
    level: 'crew',
    agentId: initialAgentId,
    crewId: initialCrewId,
  });

  // Persist every change.
  useEffect(() => {
    saveDraft(agentSlug, doc);
  }, [agentSlug, doc]);

  // Preview-chat conversation id, shared so the prompt-preview view
  // can fetch the real transcript instead of showing a placeholder.
  const [previewConversationId, setPreviewConversationId] = useState<number | null>(null);
  useEffect(() => { setPreviewConversationId(null); }, [agentSlug]);

  // Live builder memory for the preview conversation. The chat panel
  // calls refreshConversationMemory after each turn, and the
  // FieldsPanel renders values inline next to fields.
  const [conversationMemory, setConversationMemory] = useState<Record<string, Record<string, unknown>>>({});
  const refreshConversationMemory = useCallback(() => {
    if (previewConversationId === null) {
      setConversationMemory({});
      return;
    }
    import('./builderApi').then(({ fetchConversationMemory }) => {
      fetchConversationMemory({
        agentSlug,
        conversationId: previewConversationId,
        ownerUserId,
      })
        .then(setConversationMemory)
        .catch(err => console.warn('[builder] fetchConversationMemory failed:', err));
    });
  }, [agentSlug, ownerUserId, previewConversationId]);

  const updateConversationMemoryField = useCallback(
    async (args: { field: string; value?: unknown; domain?: string | null; clear?: boolean }) => {
      if (previewConversationId === null) return false;
      try {
        const { patchConversationMemory } = await import('./builderApi');
        const next = await patchConversationMemory({
          agentSlug,
          conversationId: previewConversationId,
          ownerUserId,
          ...args,
        });
        setConversationMemory(next);
        return true;
      } catch (err) {
        console.warn('[builder] patchConversationMemory failed:', err);
        return false;
      }
    },
    [agentSlug, ownerUserId, previewConversationId],
  );

  // Reset / refetch memory whenever the conversation changes.
  useEffect(() => {
    if (previewConversationId === null) {
      setConversationMemory({});
    } else {
      refreshConversationMemory();
    }
  }, [previewConversationId, refreshConversationMemory]);

  // ── Project ──
  const updateProject = useCallback(
    (patch: Partial<Pick<ProjectDoc, 'name' | 'spec'>>) => {
      setDoc(d => ({ ...d, ...patch }));
    },
    [],
  );

  // ── Agent ──
  const updateAgent = useCallback(
    (agentId: ID, patch: Partial<Pick<AgentDoc, 'name' | 'spec' | 'persona' | 'defaultCrewId'>>) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => (a.id === agentId ? { ...a, ...patch } : a)),
      }));
    },
    [],
  );

  // ── Crew CRUD ──
  const addCrew = useCallback((agentId: ID): CrewDoc => {
    const newCrew = emptyCrew(`Crew ${Date.now().toString().slice(-4)}`);
    setDoc(d => ({
      ...d,
      agents: d.agents.map(a =>
        a.id === agentId ? { ...a, crews: [...a.crews, newCrew] } : a,
      ),
    }));
    syncRef.current?.pushCreateCrew(agentId, newCrew);
    return newCrew;
  }, []);

  const removeCrew = useCallback((agentId: ID, crewId: ID) => {
    setDoc(d => ({
      ...d,
      agents: d.agents.map(a =>
        a.id === agentId ? { ...a, crews: a.crews.filter(c => c.id !== crewId) } : a,
      ),
    }));
    syncRef.current?.pushDeleteCrew(crewId);
  }, []);

  const updateCrew = useCallback(
    (
      agentId: ID,
      crewId: ID,
      patch: Partial<Pick<CrewDoc, 'name' | 'description' | 'spec' | 'persona'>>,
    ) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a =>
          a.id !== agentId
            ? a
            : {
                ...a,
                crews: a.crews.map(c => (c.id === crewId ? { ...c, ...patch } : c)),
              },
        ),
      }));
    },
    [],
  );

  // ── Addons ──
  const mapCrew = (agentId: ID, crewId: ID, fn: (c: CrewDoc) => CrewDoc) =>
    setDoc(d => ({
      ...d,
      agents: d.agents.map(a =>
        a.id !== agentId
          ? a
          : {
              ...a,
              crews: a.crews.map(c => (c.id === crewId ? fn(c) : c)),
            },
      ),
    }));

  const addAddon = useCallback((agentId: ID, crewId: ID, instance: AddonInstance) => {
    mapCrew(agentId, crewId, c => ({ ...c, addons: [...c.addons, instance] }));
  }, []);

  const updateAddonConfig = useCallback(
    (agentId: ID, crewId: ID, instanceId: ID, nextConfig: unknown) => {
      mapCrew(agentId, crewId, c => ({
        ...c,
        addons: c.addons.map(a =>
          a.instanceId === instanceId ? { ...a, config: nextConfig } : a,
        ),
      }));
    },
    [],
  );

  const updateAddonContext = useCallback(
    (agentId: ID, crewId: ID, instanceId: ID, nextContext: AddonContext) => {
      mapCrew(agentId, crewId, c => ({
        ...c,
        addons: c.addons.map(a =>
          a.instanceId === instanceId ? { ...a, context: nextContext } : a,
        ),
      }));
    },
    [],
  );

  const setAddonOutputType = useCallback(
    (agentId: ID, crewId: ID, instanceId: ID, nextType: OutputType) => {
      mapCrew(agentId, crewId, c => ({
        ...c,
        addons: c.addons.map(a =>
          a.instanceId === instanceId ? { ...a, outputType: nextType } : a,
        ),
      }));
    },
    [],
  );

  const setAddonEnabled = useCallback(
    (agentId: ID, crewId: ID, instanceId: ID, enabled: boolean) => {
      mapCrew(agentId, crewId, c => ({
        ...c,
        addons: c.addons.map(a => (a.instanceId === instanceId ? { ...a, enabled } : a)),
      }));
    },
    [],
  );

  const removeAddon = useCallback((agentId: ID, crewId: ID, instanceId: ID) => {
    mapCrew(agentId, crewId, c => ({
      ...c,
      addons: c.addons.filter(a => a.instanceId !== instanceId),
    }));
  }, []);

  // ── Crew versioning ──
  // Save overwrites the version currently being VIEWED, not the
  // active one. Active is a separate pointer set explicitly via
  // `setActiveCrewVersion`. After updating local state, the matching
  // push helper syncs to the server.
  const saveCrewVersion = useCallback((agentId: ID, crewId: ID) => {
    const d = docRef.current;
    let updatedCrew: CrewDoc | undefined;
    const next: ProjectDoc = {
      ...d,
      agents: d.agents.map(a => {
        if (a.id !== agentId) return a;
        return {
          ...a,
          crews: a.crews.map(c => {
            if (c.id !== crewId) return c;
            const body = bodyOf(c);
            const updated: CrewDoc = {
              ...c,
              versions: c.versions.map(v =>
                v.id === c.viewingVersionId
                  ? { ...v, body, createdAt: new Date().toISOString() }
                  : v,
              ),
            };
            updatedCrew = updated;
            return updated;
          }),
        };
      }),
    };
    setDoc(next);
    if (updatedCrew) syncRef.current?.pushSaveCrewVersion(updatedCrew);
  }, []);

  // Save As creates a new version from the working copy and starts
  // VIEWING it. Active is unchanged — the user has to opt in.
  const saveCrewVersionAs = useCallback(
    (agentId: ID, crewId: ID, description?: string): CrewVersion => {
      const newId = uid('ver');
      const d = docRef.current;
      let created: CrewVersion | null = null;
      let updatedCrew: CrewDoc | undefined;
      const next: ProjectDoc = {
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            crews: a.crews.map(c => {
              if (c.id !== crewId) return c;
              const nextNumber =
                c.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;
              const v: CrewVersion = {
                id: newId,
                number: nextNumber,
                description: description?.trim() || undefined,
                createdAt: new Date().toISOString(),
                body: bodyOf(c),
              };
              created = v;
              const updated: CrewDoc = {
                ...c,
                versions: [...c.versions, v],
                viewingVersionId: newId,
              };
              updatedCrew = updated;
              return updated;
            }),
          };
        }),
      };
      setDoc(next);
      if (updatedCrew) syncRef.current?.pushSaveCrewVersionAs(updatedCrew, description);
      return created!;
    },
    [],
  );

  // Load a version's body into the working copy and update the
  // VIEWING pointer. Active stays where it was.
  const setViewingCrewVersion = useCallback(
    (agentId: ID, crewId: ID, versionId: ID) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            crews: a.crews.map(c => {
              if (c.id !== crewId) return c;
              const target = c.versions.find(v => v.id === versionId);
              if (!target) return c;
              return {
                ...c,
                ...target.body,
                viewingVersionId: versionId,
              };
            }),
          };
        }),
      }));
      syncRef.current?.pushSetCrewViewing(crewId, versionId);
    },
    [],
  );

  // Flip the ACTIVE pointer. No effect on working copy or viewing.
  const setActiveCrewVersion = useCallback(
    (agentId: ID, crewId: ID, versionId: ID) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            crews: a.crews.map(c => {
              if (c.id !== crewId) return c;
              if (!c.versions.find(v => v.id === versionId)) return c;
              return { ...c, activeVersionId: versionId };
            }),
          };
        }),
      }));
      syncRef.current?.pushSetCrewActive(crewId, versionId);
    },
    [],
  );

  // Dirty compares the working copy against the VIEWING snapshot —
  // that's what Save writes to.
  const isCrewDirty = useCallback(
    (agentId: ID, crewId: ID): boolean => {
      const crew = doc.agents.find(a => a.id === agentId)?.crews.find(c => c.id === crewId);
      if (!crew) return false;
      const viewing = crew.versions.find(v => v.id === crew.viewingVersionId);
      if (!viewing) return true;
      return !bodiesEqual(bodyOf(crew), viewing.body);
    },
    [doc],
  );

  // ── Agent versioning ──
  // Same pattern as crew. Crews live outside the version body so
  // promoting an agent version doesn't disrupt crew membership.
  const saveAgentVersion = useCallback((agentId: ID) => {
    const d = docRef.current;
    let updatedAgent: AgentDoc | undefined;
    const next: ProjectDoc = {
      ...d,
      agents: d.agents.map(a => {
        if (a.id !== agentId) return a;
        const body = bodyOfAgent(a);
        const updated: AgentDoc = {
          ...a,
          versions: a.versions.map(v =>
            v.id === a.viewingVersionId
              ? { ...v, body, createdAt: new Date().toISOString() }
              : v,
          ),
        };
        updatedAgent = updated;
        return updated;
      }),
    };
    setDoc(next);
    if (updatedAgent) syncRef.current?.pushSaveAgentVersion(updatedAgent);
  }, []);

  const saveAgentVersionAs = useCallback(
    (agentId: ID, description?: string): AgentVersion => {
      const newId = uid('ver');
      const d = docRef.current;
      let created: AgentVersion | null = null;
      let updatedAgent: AgentDoc | undefined;
      const next: ProjectDoc = {
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          const nextNumber =
            a.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;
          const v: AgentVersion = {
            id: newId,
            number: nextNumber,
            description: description?.trim() || undefined,
            createdAt: new Date().toISOString(),
            body: bodyOfAgent(a),
          };
          created = v;
          const updated: AgentDoc = {
            ...a,
            versions: [...a.versions, v],
            viewingVersionId: newId,
          };
          updatedAgent = updated;
          return updated;
        }),
      };
      setDoc(next);
      if (updatedAgent) syncRef.current?.pushSaveAgentVersionAs(updatedAgent, description);
      return created!;
    },
    [],
  );

  const setViewingAgentVersion = useCallback(
    (agentId: ID, versionId: ID) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          const target = a.versions.find(v => v.id === versionId);
          if (!target) return a;
          return {
            ...a,
            ...target.body,
            viewingVersionId: versionId,
          };
        }),
      }));
      syncRef.current?.pushSetAgentViewing(agentId, versionId);
    },
    [],
  );

  const setActiveAgentVersion = useCallback(
    (agentId: ID, versionId: ID) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          if (!a.versions.find(v => v.id === versionId)) return a;
          return { ...a, activeVersionId: versionId };
        }),
      }));
      syncRef.current?.pushSetAgentActive(agentId, versionId);
    },
    [],
  );

  const isAgentDirty = useCallback(
    (agentId: ID): boolean => {
      const agent = doc.agents.find(a => a.id === agentId);
      if (!agent) return false;
      const viewing = agent.versions.find(v => v.id === agent.viewingVersionId);
      if (!viewing) return true;
      return !agentBodiesEqual(bodyOfAgent(agent), viewing.body);
    },
    [doc],
  );

  const resetDraft = useCallback(() => {
    setDoc(emptyProject(agentSlug));
  }, [agentSlug]);

  const value = useMemo<BuilderState>(
    () => ({
      doc,
      selection,
      setSelection,
      updateProject,
      updateAgent,
      addCrew,
      removeCrew,
      updateCrew,
      addAddon,
      updateAddonConfig,
      updateAddonContext,
      setAddonOutputType,
      setAddonEnabled,
      removeAddon,
      saveCrewVersion,
      saveCrewVersionAs,
      setViewingCrewVersion,
      setActiveCrewVersion,
      isCrewDirty,
      saveAgentVersion,
      saveAgentVersionAs,
      setViewingAgentVersion,
      setActiveAgentVersion,
      isAgentDirty,
      resetDraft,
      previewConversationId,
      setPreviewConversationId,
      conversationMemory,
      refreshConversationMemory,
      updateConversationMemoryField,
    }),
    [
      doc,
      selection,
      updateProject,
      updateAgent,
      addCrew,
      removeCrew,
      updateCrew,
      addAddon,
      updateAddonConfig,
      updateAddonContext,
      setAddonOutputType,
      setAddonEnabled,
      removeAddon,
      saveCrewVersion,
      saveCrewVersionAs,
      setViewingCrewVersion,
      setActiveCrewVersion,
      isCrewDirty,
      saveAgentVersion,
      saveAgentVersionAs,
      setViewingAgentVersion,
      setActiveAgentVersion,
      isAgentDirty,
      resetDraft,
      previewConversationId,
      conversationMemory,
      refreshConversationMemory,
      updateConversationMemoryField,
    ],
  );

  return <BuilderCtx.Provider value={value}>{children}</BuilderCtx.Provider>;
}

export function useBuilder(): BuilderState {
  const ctx = useContext(BuilderCtx);
  if (!ctx) throw new Error('useBuilder must be used inside <BuilderProvider>');
  return ctx;
}

// ─── Selector helpers ─────────────────────────────────────────────

export function useCurrentAgent(): AgentDoc | undefined {
  const { doc, selection } = useBuilder();
  return doc.agents.find(a => a.id === selection.agentId);
}

export function useCurrentCrew(): CrewDoc | undefined {
  const agent = useCurrentAgent();
  const { selection } = useBuilder();
  return agent?.crews.find(c => c.id === selection.crewId);
}

// Helpers to mint AddonInstance ids — exposed here so plugin code
// doesn't have to know about the uid implementation.
export function newAddonInstanceId(): ID {
  return uid('addon');
}
