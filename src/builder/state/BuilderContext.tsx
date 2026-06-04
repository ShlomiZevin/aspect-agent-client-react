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
import { fetchProject, writeApplyLog } from './builderApi';
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
    fields: crew.fields,
  };
}

function emptyCrew(name = 'Welcome'): CrewDoc {
  const initialBody: CrewBody = {
    name,
    description: '',
    spec: '',
    addons: [defaultTalker() as AddonInstance],
    fields: [],
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
    fields: agent.fields,
    domains: agent.domains ?? [],
    parameters: agent.parameters ?? [],
    dynamicContexts: agent.dynamicContexts ?? [],
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
    fields: [],
    domains: [],
    parameters: [],
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

/**
 * Factory for a brand-new ProjectDoc with one agent + one "Welcome" crew
 * (the crew gets a default Talker via `emptyCrew`). Exported so the
 * BuilderApp's "Create this agent?" gate can construct the same shape
 * the server expects to bootstrap into the DB. Keeping a single factory
 * here avoids two slightly-different "empty" definitions drifting.
 */
export function emptyProject(slug: string): ProjectDoc {
  return {
    id: uid('project'),
    name: slug,
    spec: '',
    agents: [emptyAgent(slug)],
  };
}

// ─── Context shape ────────────────────────────────────────────────

/**
 * One target inside a pending Alfred Apply. Stays in pendingAlfredApply
 * until the user explicitly Saves this entity — that's when its log row
 * gets written. If the user discards (switches version, hits the Apply
 * modal again with new content, refreshes), the target is dropped
 * without a log entry.
 */
export interface PendingApplyTarget {
  entity:     'agent' | 'crew';
  entityId:   ID;
  entityName: string;
  what_to_do: string;
  bodyBefore: unknown;
  /** Flips to true after the Save fires writeApplyLog for this target. */
  applied:    boolean;
}

export interface PendingAlfredApply {
  applyGroupId: string;
  chatId:       number;
  /**
   * One-line headline from the consolidator ("Add intent field on agent +
   * wire into Welcome crew"). Used to keep the in-canvas banner compact —
   * the long English plan stays in `description` and the per-target
   * `what_to_do` lines are in `targets`. Surfaced in a Details modal.
   */
  summary?:     string;
  description:  string;
  reason:       string;
  targets:      PendingApplyTarget[];
}

/**
 * Optional knobs for save callbacks. `attribution` decides how a save
 * interacts with a pending Alfred apply for the same entity:
 *   - 'alfred'  → fire log/apply with actor='alfred' (default when a
 *                  pending Alfred target matches this entity)
 *   - 'manual'  → fire log/apply with actor='manual' (user took the
 *                  Alfred draft and reshaped it; credit themselves)
 *   - 'none'    → no log row; pending target is cleared anyway since
 *                  the body is committed
 *   - undefined → if a pending Alfred target matches this entity,
 *                  treat as 'alfred'; otherwise treat as a plain save
 *                  (no Alfred log row written either way)
 */
export type SaveAttribution = 'alfred' | 'manual' | 'none';

export interface SaveOpts {
  attribution?: SaveAttribution;
}

export interface ApplyAlfredBodiesArgs {
  applyGroupId: string;
  chatId:       number;
  /** Short headline from the consolidator. Optional — falls back to a
   *  generic banner label when absent. */
  summary?:     string;
  description:  string;
  reason:       string;
  bodies: Array<{
    entity:     'agent' | 'crew';
    entityId:   ID;
    entityName: string;
    what_to_do: string;
    bodyBefore: unknown;
    newBody:    Record<string, unknown>;
  }>;
}

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
    patch: Partial<Pick<AgentDoc, 'name' | 'spec' | 'persona' | 'defaultCrewId' | 'fields' | 'domains' | 'parameters' | 'dynamicContexts'>>,
  ) => void;
  /**
   * Rename a declared domain. Cascades through `agent.domains`,
   * `agent.fields[].domain`, and every crew's `fields[].domain`. Single
   * atomic state update so the cascade doesn't tear across React renders
   * or trip the project-sync queue mid-update.
   */
  renameAgentDomain: (agentId: ID, oldName: string, newName: string) => void;

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
  reorderAddonInLane: (
    agentId: ID,
    crewId: ID,
    lane: 'main' | 'background' | 'offline',
    fromIdx: number,
    toIdx: number,
  ) => void;

  // Crew versioning
  /** Overwrite the *viewing* version's snapshot with the current working state. */
  saveCrewVersion: (agentId: ID, crewId: ID, opts?: SaveOpts) => void;
  /** Create a new version from the current working state and start viewing it. Active stays where it was. */
  saveCrewVersionAs: (agentId: ID, crewId: ID, description?: string, opts?: SaveOpts) => CrewVersion;
  /** Load a version's snapshot into the working state. Active stays where it was. */
  setViewingCrewVersion: (agentId: ID, crewId: ID, versionId: ID) => void;
  /** Flip the active-version pointer. Doesn't touch the working state. */
  setActiveCrewVersion: (agentId: ID, crewId: ID, versionId: ID) => void;
  /** Revert the working copy to the viewing version's body. Also clears
   *  any pending Alfred apply target for this crew (without logging). */
  discardCrewChanges: (agentId: ID, crewId: ID) => void;
  /** Permanently delete a crew version. Server refuses last / active /
   *  viewing — the thrown Error carries `code` so the UI can react. */
  deleteCrewVersion: (agentId: ID, crewId: ID, versionId: ID) => Promise<void>;
  /** True when the working state differs from the *viewing* version's snapshot. */
  isCrewDirty: (agentId: ID, crewId: ID) => boolean;

  // Agent versioning — same shape as crew.
  saveAgentVersion: (agentId: ID, opts?: SaveOpts) => void;
  saveAgentVersionAs: (agentId: ID, description?: string, opts?: SaveOpts) => AgentVersion;
  setViewingAgentVersion: (agentId: ID, versionId: ID) => void;
  setActiveAgentVersion: (agentId: ID, versionId: ID) => void;
  discardAgentChanges: (agentId: ID) => void;
  /** Permanently delete an agent version. Same refusal semantics as crew. */
  deleteAgentVersion: (agentId: ID, versionId: ID) => Promise<void>;
  isAgentDirty: (agentId: ID) => boolean;

  // Reset (debug helper)
  resetDraft: () => void;

  /**
   * Refetch the ProjectDoc from the server and replace the local
   * working copy. Used after destructive server-side state changes
   * that bypass the normal save flow.
   */
  reloadProject: () => Promise<void>;

  /**
   * Currently-pending Alfred Apply. Set when the user accepts the
   * preview modal's plan; cleared once every target has been Saved
   * (or when a new Apply replaces it). The presence of this state is
   * what causes Save actions to fire `writeApplyLog`.
   */
  pendingAlfredApply: PendingAlfredApply | null;

  /**
   * Drop generated bodies into the working copy AND stash the Apply
   * metadata so the eventual Save(s) can write the log row(s). Does
   * NOT save — the user does that themselves via the normal Save /
   * Save as buttons.
   */
  applyAlfredBodies: (args: ApplyAlfredBodiesArgs) => void;

  // Preview conversation — the conversationId for the in-builder
  // "User Chat" panel. Exposed so prompt-preview views can fetch
  // the actual transcript for the history sidebar.
  previewConversationId: number | null;
  setPreviewConversationId: (id: number | null) => void;

  // Live brain state for the preview conversation. Two parallel
  // sections: `memory` (facts the brain remembers) and `thinking`
  // (the current strategic plan). FieldsPanel renders memory values
  // inline next to fields; the Thinking panel below the Cortex renders
  // its section as a card. Refetched after every chat turn.
  conversationMemory: {
    memory:   Record<string, Record<string, unknown>>;
    thinking: Record<string, Record<string, unknown>>;
  };
  refreshConversationMemory: () => void;
  /**
   * Edit / clear a single field value in the live conversation brain.
   * Defaults to `kind: 'memory'`. No-op when there's no active preview
   * conversation. Returns true on success.
   */
  updateConversationMemoryField: (args: {
    field: string;
    value?: unknown;
    domain?: string | null;
    /** Which brain section to write to. Default `'memory'`. */
    kind?: 'memory' | 'thinking';
    clear?: boolean;
  }) => Promise<boolean>;
  /**
   * Optimistic, local-only merge of memory writes (the same shape
   * the server emits on `addon.output`). No network. Each write's
   * `kind` routes it to the memory / thinking section; omitted =
   * 'memory'. Used by UserChat to surface fresh writes in the panels
   * before the chain finishes. Reconciled by the post-turn
   * `refreshConversationMemory()` call.
   */
  applyLocalMemoryWrites: (
    writes: Array<{
      kind?: 'memory' | 'thinking';
      domain: string | null;
      field: string;
      value: unknown;
    }>,
  ) => void;
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
    onLoaded: setDoc,
  });
  const syncRef = useRef<ProjectSyncApi>(sync);
  syncRef.current = sync;


  // First agent is the implicit "current" agent during this session.
  // We land on the agent view by default — the crew view is one click
  // away in the sidebar, and the agent surface (persona, schema,
  // dynamic context, parameters) is what most refreshes are about.
  const initialAgentId = doc.agents[0]?.id;
  const initialCrewId = doc.agents[0]?.defaultCrewId ?? doc.agents[0]?.crews[0]?.id;

  const [selection, setSelection] = useState<BuilderSelection>({
    level: 'agent',
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

  // Mirror in a ref so `refreshConversationMemory` always sees the
  // current id, not the one that was current at the render that
  // baked its closure. Subtle but load-bearing: on the FIRST message
  // of a new conversation, send() calls setPreviewConversationId(id)
  // and immediately starts the SSE stream with a handleEvent captured
  // BEFORE the re-render happened. Without this ref, the `done`-event
  // refresh sees previewConversationId === null and clears the just-
  // surfaced extractor values.
  const previewConvIdRef = useRef<number | null>(previewConversationId);
  previewConvIdRef.current = previewConversationId;

  // Live brain state for the preview conversation. The chat panel
  // calls refreshConversationMemory after each turn, and the
  // FieldsPanel + Thinking panels render values inline.
  const [conversationMemory, setConversationMemory] = useState<{
    memory:   Record<string, Record<string, unknown>>;
    thinking: Record<string, Record<string, unknown>>;
  }>({ memory: {}, thinking: {} });
  const refreshConversationMemory = useCallback(() => {
    // No conv yet → nothing to fetch. Deliberately DO NOT reset the
    // local cache here. The dedicated effect below handles explicit
    // reset when previewConversationId transitions to null (e.g. "New
    // chat" was clicked). A stale-closure call from an in-flight SSE
    // stream must NOT clobber the optimistic writes already applied
    // for the live conversation.
    const cid = previewConvIdRef.current;
    if (cid === null) return;
    import('./builderApi').then(({ fetchConversationMemory }) => {
      fetchConversationMemory({
        agentSlug,
        conversationId: cid,
        ownerUserId,
      })
        .then(setConversationMemory)
        .catch(err => console.warn('[builder] fetchConversationMemory failed:', err));
    });
  }, [agentSlug, ownerUserId]);

  /**
   * Merge a batch of memory writes into the local cache without
   * hitting the server. Used by UserChat to surface live extractor
   * output the moment the extractor finishes — long before the
   * talker streams back. The server has already persisted these
   * writes (BuilderRunner does it before emitting addon.output);
   * the post-turn `refreshConversationMemory()` reconciles in case
   * anything raced.
   *
   * `_general` bucket holds fields whose domain is null/empty —
   * matches the server's `builderMemory.applyWrites` semantics.
   */
  const applyLocalMemoryWrites = useCallback(
    (writes: Array<{
      kind?: 'memory' | 'thinking';
      domain: string | null;
      field: string;
      value: unknown;
    }>) => {
      if (!Array.isArray(writes) || writes.length === 0) return;
      setConversationMemory(prev => {
        const next = {
          memory:   { ...prev.memory },
          thinking: { ...prev.thinking },
        };
        for (const w of writes) {
          if (w.value === null || w.value === undefined) continue;
          const section = w.kind === 'thinking' ? 'thinking' : 'memory';
          const key = (w.domain && String(w.domain).trim()) ? String(w.domain) : '_general';
          next[section][key] = { ...(next[section][key] || {}), [w.field]: w.value };
        }
        return next;
      });
    },
    [],
  );

  const updateConversationMemoryField = useCallback(
    async (args: {
      field: string;
      value?: unknown;
      domain?: string | null;
      kind?: 'memory' | 'thinking';
      clear?: boolean;
    }) => {
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
      setConversationMemory({ memory: {}, thinking: {} });
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
    (agentId: ID, patch: Partial<Pick<AgentDoc, 'name' | 'spec' | 'persona' | 'defaultCrewId' | 'fields' | 'domains' | 'parameters' | 'dynamicContexts'>>) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => (a.id === agentId ? { ...a, ...patch } : a)),
      }));
    },
    [],
  );

  const renameAgentDomain = useCallback(
    (agentId: ID, oldName: string, newName: string) => {
      if (oldName === newName) return;
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          // Re-declare the domain under its new name (dedup-preserving order).
          const declared = a.domains ?? [];
          const renamedDeclared = declared
            .map(x => (x === oldName ? newName : x))
            .filter((x, i, arr) => arr.indexOf(x) === i);
          return {
            ...a,
            domains: renamedDeclared,
            fields: a.fields.map(f =>
              f.domain === oldName ? { ...f, domain: newName } : f,
            ),
            crews: a.crews.map(c => ({
              ...c,
              fields: c.fields.map(f =>
                f.domain === oldName ? { ...f, domain: newName } : f,
              ),
            })),
          };
        }),
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

  /**
   * Reorder a lane's addons. `fromIdx` and `toIdx` are indexes
   * *within the lane* (as the user sees them in the canvas). The
   * function maps them back into positions in the global
   * `crew.addons` array, preserving the relative position of
   * addons in other lanes.
   *
   * Used by the Cortex drag-and-drop. Order is meaningful for
   * transitions — running a Transition Router after the Field
   * Extractor vs. after the Talker is a different agent.
   */
  const reorderAddonInLane = useCallback(
    (agentId: ID, crewId: ID, lane: 'main' | 'background' | 'offline', fromIdx: number, toIdx: number) => {
      mapCrew(agentId, crewId, c => {
        const positions: number[] = [];
        c.addons.forEach((a, i) => { if (a.lane === lane) positions.push(i); });
        if (fromIdx < 0 || fromIdx >= positions.length) return c;
        if (toIdx   < 0 || toIdx   >= positions.length) return c;
        if (fromIdx === toIdx) return c;
        const reorderedPositions = [...positions];
        const [movedPos] = reorderedPositions.splice(fromIdx, 1);
        reorderedPositions.splice(toIdx, 0, movedPos);
        const next = [...c.addons];
        positions.forEach((globalIdx, k) => {
          next[globalIdx] = c.addons[reorderedPositions[k]];
        });
        return { ...c, addons: next };
      });
    },
    [],
  );

  // ─── Pending Alfred Apply ─────────────────────────────────────────
  // Must be defined BEFORE the save callbacks below because they
  // reference `fireApplyLogIfPending` in their useCallback deps array
  // — those deps are read at callback creation time, which would
  // otherwise hit the temporal dead zone on first render.
  //
  // Held in component state (and a mirroring ref for synchronous reads
  // inside save callbacks). NOT persisted — if the user refreshes mid-
  // apply, the working copy reverts to the saved state anyway, so the
  // pending Apply context naturally disappears with it.
  const [pendingAlfredApply, setPendingAlfredApply] = useState<PendingAlfredApply | null>(null);
  const pendingApplyRef = useRef<PendingAlfredApply | null>(null);
  pendingApplyRef.current = pendingAlfredApply;

  const applyAlfredBodies = useCallback((args: ApplyAlfredBodiesArgs) => {
    // Merge the generated bodies into the working copy in one pass.
    // Each AgentBody / CrewBody is shallow-merged into its host doc;
    // version metadata (versions[], active/viewing pointers) is left
    // alone — Apply produces a working-copy diff, not a new version.
    setDoc(d => {
      const next: ProjectDoc = {
        ...d,
        agents: d.agents.map(a => {
          const agentTarget = args.bodies.find(
            b => b.entity === 'agent' && b.entityId === a.id,
          );
          let agent = a;
          if (agentTarget) {
            const ab = agentTarget.newBody as Partial<AgentDoc>;
            agent = {
              ...a,
              ...(ab.name          !== undefined && { name: ab.name as string }),
              ...(ab.slug          !== undefined && { slug: ab.slug as string }),
              ...(ab.spec          !== undefined && { spec: ab.spec as string }),
              ...(ab.persona       !== undefined && { persona: ab.persona as string }),
              ...(ab.defaultCrewId !== undefined && { defaultCrewId: ab.defaultCrewId as ID | undefined }),
              ...(Array.isArray(ab.fields) && { fields: ab.fields as AgentDoc['fields'] }),
            };
          }
          agent = {
            ...agent,
            crews: agent.crews.map(c => {
              const crewTarget = args.bodies.find(
                b => b.entity === 'crew' && b.entityId === c.id,
              );
              if (!crewTarget) return c;
              const cb = crewTarget.newBody as Partial<CrewDoc>;
              return {
                ...c,
                ...(cb.name        !== undefined && { name: cb.name as string }),
                ...(cb.description !== undefined && { description: cb.description as string | undefined }),
                ...(cb.spec        !== undefined && { spec: cb.spec as string }),
                ...(cb.persona     !== undefined && { persona: cb.persona as string | undefined }),
                ...(Array.isArray(cb.addons) && { addons: cb.addons as CrewDoc['addons'] }),
                ...(Array.isArray(cb.fields) && { fields: cb.fields as CrewDoc['fields'] }),
              };
            }),
          };
          return agent;
        }),
      };
      docRef.current = next;
      return next;
    });

    setPendingAlfredApply({
      applyGroupId: args.applyGroupId,
      chatId:       args.chatId,
      summary:      args.summary,
      description:  args.description,
      reason:       args.reason,
      targets:      args.bodies.map(b => ({
        entity:     b.entity,
        entityId:   b.entityId,
        entityName: b.entityName,
        what_to_do: b.what_to_do,
        bodyBefore: b.bodyBefore,
        applied:    false,
      })),
    });
  }, []);

  /**
   * Called from inside each save action right after the server push
   * has been fired. If the entity matches a pending Alfred target,
   * we either fire the log endpoint (actor = alfred | manual) or skip
   * logging entirely (attribution='none'). Either way the target is
   * marked applied and pendingAlfredApply clears when fully drained.
   *
   * No-op when there's no matching pending target — a plain save with
   * no Alfred context behind it does nothing here.
   */
  const fireApplyLogIfPending = useCallback((args: {
    parentAgentId: ID;
    entity: 'agent' | 'crew';
    entityId: ID;
    savedBody: unknown;
    /** Defaults to 'alfred' when a matching pending target exists. */
    attribution?: SaveAttribution;
  }) => {
    const pending = pendingApplyRef.current;
    if (!pending) return;
    const idx = pending.targets.findIndex(
      t => t.entity === args.entity && t.entityId === args.entityId && !t.applied,
    );
    if (idx === -1) return;
    const target = pending.targets[idx];

    const attribution: SaveAttribution = args.attribution || 'alfred';

    if (attribution !== 'none') {
      // Fire-and-forget — matches the rest of the sync layer's contract.
      // Tiny risk: if the save itself failed server-side, we get an
      // orphan log row. Save endpoints are simple JSONB writes — this
      // is rare; treating it as the cost of keeping the save layer
      // synchronous-looking for callers.
      writeApplyLog({
        agentId:      args.parentAgentId,
        entity:       target.entity,
        entityId:     target.entityId,
        entityName:   target.entityName,
        applyGroupId: pending.applyGroupId,
        description:  pending.description,
        reason:       pending.reason,
        whatChanged:  target.what_to_do,
        bodyBefore:   target.bodyBefore,
        bodyAfter:    args.savedBody,
        sourceChatId: pending.chatId,
        actor:        attribution,
        ownerUserId,
      }).catch(err => console.error('[builder] writeApplyLog failed:', err));
    }

    const nextTargets = pending.targets.map((t, i) =>
      i === idx ? { ...t, applied: true } : t,
    );
    const allApplied = nextTargets.every(t => t.applied);
    const nextState = allApplied
      ? null
      : { ...pending, targets: nextTargets };
    setPendingAlfredApply(nextState);
    pendingApplyRef.current = nextState;
  }, [ownerUserId]);

  /**
   * Drop any pending Alfred apply target for this entity (without
   * logging). Used when the user discards their working copy — the
   * Alfred draft is being thrown away, so no log row is appropriate.
   */
  const dropPendingAlfredTarget = useCallback((entity: 'agent' | 'crew', entityId: ID) => {
    const pending = pendingApplyRef.current;
    if (!pending) return;
    const nextTargets = pending.targets.filter(
      t => !(t.entity === entity && t.entityId === entityId),
    );
    const nextState = nextTargets.length === 0
      ? null
      : { ...pending, targets: nextTargets };
    setPendingAlfredApply(nextState);
    pendingApplyRef.current = nextState;
  }, []);

  // ── Crew versioning ──
  // Save overwrites the version currently being VIEWED, not the
  // active one. Active is a separate pointer set explicitly via
  // `setActiveCrewVersion`. After updating local state, the matching
  // push helper syncs to the server.
  const saveCrewVersion = useCallback((agentId: ID, crewId: ID, opts?: SaveOpts) => {
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
    // Keep docRef in sync immediately so a follow-up save in the
    // same tick (e.g. the cross-entity save via VersionMenu when
    // both crew + agent are dirty) reads the just-committed state
    // instead of overwriting it.
    docRef.current = next;
    if (updatedCrew) {
      syncRef.current?.pushSaveCrewVersion(updatedCrew);
      fireApplyLogIfPending({
        parentAgentId: agentId,
        entity:        'crew',
        entityId:      crewId,
        savedBody:     bodyOf(updatedCrew),
        attribution:   opts?.attribution,
      });
    }
  }, [fireApplyLogIfPending]);

  // Save As creates a new version from the working copy and starts
  // VIEWING it. Active is unchanged — the user has to opt in.
  const saveCrewVersionAs = useCallback(
    (agentId: ID, crewId: ID, description?: string, opts?: SaveOpts): CrewVersion => {
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
      docRef.current = next;
      if (updatedCrew) {
        syncRef.current?.pushSaveCrewVersionAs(updatedCrew, description);
        fireApplyLogIfPending({
          parentAgentId: agentId,
          entity:        'crew',
          entityId:      crewId,
          savedBody:     bodyOf(updatedCrew),
          attribution:   opts?.attribution,
        });
      }
      return created!;
    },
    [fireApplyLogIfPending],
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

  /**
   * Permanently delete a crew version. Server is the authority on
   * what's deletable (last / active / viewing are refused with a
   * coded 409); we push first and only mutate local state on success.
   * Throws on refusal so the UI can surface the reason.
   */
  const deleteCrewVersion = useCallback(
    async (agentId: ID, crewId: ID, versionId: ID): Promise<void> => {
      await syncRef.current?.pushDeleteCrewVersion(crewId, versionId);
      const d = docRef.current;
      const next: ProjectDoc = {
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            crews: a.crews.map(c => {
              if (c.id !== crewId) return c;
              return { ...c, versions: c.versions.filter(v => v.id !== versionId) };
            }),
          };
        }),
      };
      setDoc(next);
      docRef.current = next;
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

  /**
   * Revert the crew's working copy to whatever is currently in the
   * viewing version's body. Also drops any pending Alfred apply
   * target for this crew — the Alfred draft is being thrown away, so
   * no log row gets written. Use this when the user dislikes their
   * edits (or Alfred's) and wants to start over from the saved state.
   */
  const discardCrewChanges = useCallback((agentId: ID, crewId: ID) => {
    setDoc(d => {
      const next: ProjectDoc = {
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            crews: a.crews.map(c => {
              if (c.id !== crewId) return c;
              const viewing = c.versions.find(v => v.id === c.viewingVersionId);
              if (!viewing) return c;
              const body = viewing.body;
              return {
                ...c,
                name:        body.name,
                description: body.description,
                spec:        body.spec,
                persona:     body.persona,
                addons:      Array.isArray(body.addons) ? body.addons : [],
                fields:      Array.isArray(body.fields) ? body.fields : [],
              };
            }),
          };
        }),
      };
      docRef.current = next;
      return next;
    });
    dropPendingAlfredTarget('crew', crewId);
  }, [dropPendingAlfredTarget]);

  // ── Agent versioning ──
  // Same pattern as crew. Crews live outside the version body so
  // promoting an agent version doesn't disrupt crew membership.
  const saveAgentVersion = useCallback((agentId: ID, opts?: SaveOpts) => {
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
    docRef.current = next;
    if (updatedAgent) {
      syncRef.current?.pushSaveAgentVersion(updatedAgent);
      fireApplyLogIfPending({
        parentAgentId: agentId,
        entity:        'agent',
        entityId:      agentId,
        savedBody:     bodyOfAgent(updatedAgent),
        attribution:   opts?.attribution,
      });
    }
  }, [fireApplyLogIfPending]);

  const saveAgentVersionAs = useCallback(
    (agentId: ID, description?: string, opts?: SaveOpts): AgentVersion => {
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
      docRef.current = next;
      if (updatedAgent) {
        syncRef.current?.pushSaveAgentVersionAs(updatedAgent, description);
        fireApplyLogIfPending({
          parentAgentId: agentId,
          entity:        'agent',
          entityId:      agentId,
          savedBody:     bodyOfAgent(updatedAgent),
          attribution:   opts?.attribution,
        });
      }
      return created!;
    },
    [fireApplyLogIfPending],
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

  const deleteAgentVersion = useCallback(
    async (agentId: ID, versionId: ID): Promise<void> => {
      await syncRef.current?.pushDeleteAgentVersion(agentId, versionId);
      const d = docRef.current;
      const next: ProjectDoc = {
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          return { ...a, versions: a.versions.filter(v => v.id !== versionId) };
        }),
      };
      setDoc(next);
      docRef.current = next;
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

  /**
   * Revert the agent's working copy (shell fields only — crews live
   * elsewhere) to the viewing version's body. Also drops any pending
   * Alfred apply target for this agent.
   */
  const discardAgentChanges = useCallback((agentId: ID) => {
    setDoc(d => {
      const next: ProjectDoc = {
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          const viewing = a.versions.find(v => v.id === a.viewingVersionId);
          if (!viewing) return a;
          const body = viewing.body;
          return {
            ...a,
            name:          body.name,
            slug:          body.slug,
            spec:          body.spec,
            persona:       body.persona,
            defaultCrewId: body.defaultCrewId,
            fields:        Array.isArray(body.fields) ? body.fields : [],
          };
        }),
      };
      docRef.current = next;
      return next;
    });
    dropPendingAlfredTarget('agent', agentId);
  }, [dropPendingAlfredTarget]);

  const resetDraft = useCallback(() => {
    setDoc(emptyProject(agentSlug));
  }, [agentSlug]);

  /**
   * Refetch from the server and replace the working copy. Used after
   * the Alfred Apply flow saves new bodies — the canvas needs to show
   * the new state without a page reload.
   */
  const reloadProject = useCallback(async () => {
    try {
      const fresh = await fetchProject({ agentSlug, ownerUserId });
      if (fresh) setDoc(fresh);
    } catch (err) {
      console.error('[builder] reloadProject failed:', err);
    }
  }, [agentSlug, ownerUserId]);

  const value = useMemo<BuilderState>(
    () => ({
      doc,
      selection,
      setSelection,
      updateProject,
      updateAgent,
      renameAgentDomain,
      addCrew,
      removeCrew,
      updateCrew,
      addAddon,
      updateAddonConfig,
      updateAddonContext,
      setAddonOutputType,
      setAddonEnabled,
      removeAddon,
      reorderAddonInLane,
      saveCrewVersion,
      saveCrewVersionAs,
      setViewingCrewVersion,
      setActiveCrewVersion,
      discardCrewChanges,
      deleteCrewVersion,
      isCrewDirty,
      saveAgentVersion,
      saveAgentVersionAs,
      setViewingAgentVersion,
      setActiveAgentVersion,
      discardAgentChanges,
      deleteAgentVersion,
      isAgentDirty,
      resetDraft,
      reloadProject,
      pendingAlfredApply,
      applyAlfredBodies,
      previewConversationId,
      setPreviewConversationId,
      conversationMemory,
      refreshConversationMemory,
      updateConversationMemoryField,
      applyLocalMemoryWrites,
    }),
    [
      doc,
      selection,
      updateProject,
      updateAgent,
      renameAgentDomain,
      addCrew,
      removeCrew,
      updateCrew,
      addAddon,
      updateAddonConfig,
      updateAddonContext,
      setAddonOutputType,
      setAddonEnabled,
      removeAddon,
      reorderAddonInLane,
      saveCrewVersion,
      saveCrewVersionAs,
      setViewingCrewVersion,
      setActiveCrewVersion,
      discardCrewChanges,
      deleteCrewVersion,
      isCrewDirty,
      saveAgentVersion,
      saveAgentVersionAs,
      setViewingAgentVersion,
      setActiveAgentVersion,
      discardAgentChanges,
      deleteAgentVersion,
      isAgentDirty,
      resetDraft,
      reloadProject,
      pendingAlfredApply,
      applyAlfredBodies,
      previewConversationId,
      conversationMemory,
      refreshConversationMemory,
      updateConversationMemoryField,
      applyLocalMemoryWrites,
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
