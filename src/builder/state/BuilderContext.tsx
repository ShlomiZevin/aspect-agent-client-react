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
import { fetchProject, writeApplyLog, type LiveBrainPanelData } from './builderApi';
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
import { clearDraft, loadDraft, saveDraft, normalizeMainStepFlags } from './draftStorage';
import { talkerPlugin, TALKER_PLUGIN_ID } from '../plugins/talker/addon.talker';
import { defaultContextFor, defaultOutputTypeFor } from '../registry/plugins';
import { cascadeFieldRename } from './fieldRenameCascade';
import {
  cascadeDomainTokens,
  cascadeEnumNameRename,
  cascadeEnumSectionRename,
  cascadeKbDomainTokens,
  cascadeParameterRename,
  cascadePersonaRename,
  cascadeSnippetRename,
  cascadeSummarizerRename,
  cascadeTagRename,
  cascadeThinkingDomainTokens,
  deleteAgentTag,
} from './promptTokenCascade';

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

export function bodyOf(crew: CrewDoc): CrewBody {
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

export function bodyOfAgent(agent: AgentDoc): AgentBody {
  return {
    name: agent.name,
    slug: agent.slug,
    spec: agent.spec,
    persona: agent.persona,
    personas: agent.personas ?? [],
    defaultCrewId: agent.defaultCrewId,
    fields: agent.fields,
    domains: agent.domains ?? [],
    // Same empty==absent trick as liveBrain below — agents that never
    // declared tags keep comparing equal to their pre-tags version bodies.
    ...((agent.tags?.length) ? { tags: agent.tags } : {}),
    parameters: agent.parameters ?? [],
    enums: agent.enums ?? [],
    cortex: agent.cortex ?? [],
    snippets: agent.snippets ?? [],
    // Only snapshot liveBrain once it has panels, so agents that never
    // used the feature compare equal to their pre-liveBrain version
    // bodies (no spurious "dirty" on load). Empty == absent.
    ...((agent.liveBrain?.panels?.length || agent.liveBrain?.frame || agent.liveBrain?.enabled === false) ? { liveBrain: agent.liveBrain } : {}),
    // Same empty==absent trick for the Profiler — without this, any agent
    // with a profiler shows a permanent phantom "unsaved changes" (the
    // working copy carries `profiler`, the compared body wouldn't).
    ...((agent.profiler?.panels?.length || agent.profiler?.frame || agent.profiler?.ask || agent.profiler?.enabled === false) ? { profiler: agent.profiler } : {}),
    // Same empty==absent trick for Triggers. Without it every agent that
    // has never used the feature would carry an empty `triggers` key the
    // saved version body doesn't have, and show a permanent phantom
    // "unsaved changes" the moment the builder loads.
    ...((agent.triggers?.triggers?.length || agent.triggers?.enabled === false) ? { triggers: agent.triggers } : {}),
  };
}

function agentBodiesEqual(a: AgentBody, b: AgentBody): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * The client's visible working copies of one agent + its crews, in the
 * shape the Alfred endpoints accept (`workingBodies`). Shared by the
 * brainstorm chat, Apply preview, and Apply generation so all Alfred
 * surfaces read the DRAFT the user actually sees.
 */
export function workingBodiesOf(
  doc: ProjectDoc,
  agentSlug: string,
): { agent: { id: ID; body: AgentBody }; crews: Array<{ id: ID; body: CrewBody }> } | undefined {
  const agent = doc.agents.find(a => a.slug === agentSlug) ?? doc.agents[0];
  if (!agent) return undefined;
  return {
    agent: { id: agent.id, body: bodyOfAgent(agent) },
    crews: agent.crews.map(c => ({ id: c.id, body: bodyOf(c) })),
  };
}

/**
 * Does a stored draft contain UNSAVED work — any agent/crew whose
 * working copy differs from its own viewing-version snapshot?
 *
 * This is the only thing the localStorage draft is for: protecting
 * in-progress edits across a refresh/crash. A CLEAN draft is just a
 * stale cache of the server — preferring it over the freshly fetched
 * doc made the builder blind to changes saved elsewhere (another
 * browser/user saved; local kept showing the old state with no way
 * to refetch). Missing snapshots count as dirty — when in doubt,
 * keep the draft rather than risk dropping someone's edits.
 */
function draftHasUnsavedWork(draft: ProjectDoc): boolean {
  for (const agent of draft.agents) {
    const viewingA = agent.versions.find(v => v.id === agent.viewingVersionId);
    if (!viewingA || !agentBodiesEqual(bodyOfAgent(agent), viewingA.body)) return true;
    for (const crew of agent.crews) {
      const viewingC = crew.versions.find(v => v.id === crew.viewingVersionId);
      if (!viewingC || !bodiesEqual(bodyOf(crew), viewingC.body)) return true;
    }
  }
  return false;
}

function emptyAgent(slug: string): AgentDoc {
  const crew = emptyCrew('Welcome');
  const initialBody: AgentBody = {
    name: slug,
    slug,
    spec: '',
    persona: '',
    // New agents start with one general persona ("main") applied to all
    // addons — the out-of-the-box equivalent of the old single persona.
    personas: [{ id: uid('persona'), name: 'main', content: '', appliesTo: ['*'] }],
    defaultCrewId: crew.id,
    fields: [],
    domains: [],
    parameters: [],
    enums: [],
    cortex: [],
    snippets: [],
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
    patch: Partial<Pick<AgentDoc, 'name' | 'spec' | 'persona' | 'personas' | 'defaultCrewId' | 'fields' | 'domains' | 'tags' | 'parameters' | 'enums' | 'snippets' | 'liveBrain' | 'profiler' | 'triggers'>>,
  ) => void;
  /**
   * Rename a declared domain. Cascades through `agent.domains`,
   * `agent.fields[].domain`, and every crew's `fields[].domain`. Single
   * atomic state update so the cascade doesn't tear across React renders
   * or trip the project-sync queue mid-update.
   */
  renameAgentDomain: (agentId: ID, oldName: string, newName: string) => void;

  /**
   * Cascade a field rename across every place that stores the field's
   * name — transition router conditions, addon filters, and (future)
   * prompt / snippet / persona token bodies. Single atomic state
   * update; see `fieldRenameCascade.ts` for the registry of surfaces.
   *
   * Does NOT touch the FieldDef itself — the caller (typically
   * `useCrewFields.updateField`) is responsible for patching the
   * field's `name`. Splitting the two keeps each call site honest
   * about which it's doing.
   */
  applyFieldRenameCascade: (agentId: ID, oldName: string, newName: string) => void;

  /**
   * Token-rename cascade for every entity kind whose name appears in a
   * prompt token. Wraps the pure helpers in `promptTokenCascade.ts`
   * with the same atomic-update pattern as `applyFieldRenameCascade`.
   *
   * Sites of `kind`:
   *   - 'enum'       — `{{enum:N}}`, `{{enum:N:SEC}}`, `{{enum:N:values}}`
   *   - 'persona'    — `{{persona:N}}`
   *   - 'snippet'    — `{{snippet:N}}`
   *   - 'param'      — `{{param:N}}`
   *   - 'summarizer' — `{{summary:N}}` + addon history pointers
   *
   * Enum section rename uses `applyEnumSectionRenameCascade` instead
   * because it needs the enum id + name context.
   *
   * Domain rename is folded into `renameAgentDomain` so the data side
   * (FieldDef.domain) and the token side stay one atomic update.
   */
  applyTokenRenameCascade: (
    agentId: ID,
    kind: 'enum' | 'persona' | 'snippet' | 'param' | 'summarizer' | 'tag' | 'kbDomain' | 'thinkingDomain',
    oldName: string,
    newName: string,
  ) => void;

  /**
   * Strip a tag from the agent — removes it from `agent.tags` and from
   * every `FieldDef.tags[]` across the agent + crews. Leaves
   * `{{tag:NAME}}` tokens in prompts AS-IS so the broken reference
   * shows up to the author (same contract as enum/snippet delete).
   */
  removeAgentTag: (agentId: ID, tagName: string) => void;

  /**
   * Enum section rename — rewrites `{{enum:E:SEC}}` (one specific
   * enum) and `{{dc:F:SEC}}` for every field bound to that enum.
   * Requires the enum's id (to find bound fields) and current name
   * (literal in the token).
   */
  applyEnumSectionRenameCascade: (
    agentId: ID,
    enumId: ID,
    enumName: string,
    oldSection: string,
    newSection: string,
  ) => void;

  // Crew CRUD + edit
  addCrew: (agentId: ID) => CrewDoc;
  removeCrew: (agentId: ID, crewId: ID) => void;
  /** Reorder the crew list (sidebar drag). Visual only. */
  reorderCrews: (agentId: ID, orderedCrewIds: ID[]) => void;
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
  /** Toggle whether this blocking-lane addon joins the previous
   *  addon's parallel step (`‖`) or starts a new one (`→`). See
   *  `AddonInstance.joinsPreviousStep`. */
  setAddonJoinsPreviousStep: (
    agentId: ID,
    crewId: ID,
    instanceId: ID,
    joins: boolean,
  ) => void;
  removeAddon: (agentId: ID, crewId: ID, instanceId: ID) => void;
  reorderAddonInLane: (
    agentId: ID,
    crewId: ID,
    lane: 'main' | 'background' | 'offline',
    fromIdx: number,
    toIdx: number,
  ) => void;
  /** Move an addon between containers (crew ↔ crew ↔ agent cortex,
   *  `crewId: null` = cortex) and/or lanes, appended at the end of
   *  the destination. Atomic; both touched entities go dirty. */
  moveAddon: (
    agentId: ID,
    instanceId: ID,
    from: { crewId: ID | null },
    to: { crewId: ID | null; lane: 'main' | 'offline' },
  ) => void;
  /** Same picker as moveAddon but the original stays — a clone with a
   *  fresh instanceId (+" copy" name) lands at the destination's end. */
  duplicateAddon: (
    agentId: ID,
    instanceId: ID,
    from: { crewId: ID | null },
    to: { crewId: ID | null; lane: 'main' | 'offline' },
  ) => void;

  // ── Agent-level cortex (parallel surface to the crew chain) ──
  // Same shape as the crew mutations above with `crewId` removed.
  // Runs BEFORE the crew's cortex on every turn. Restricted plugins
  // (Talker, Transition Router) are filtered out at the picker level
  // on the client; the server runtime also defensively filters them.
  addAgentAddon: (agentId: ID, instance: AddonInstance) => void;
  updateAgentAddonConfig: (
    agentId: ID,
    instanceId: ID,
    nextConfig: unknown,
  ) => void;
  updateAgentAddonContext: (
    agentId: ID,
    instanceId: ID,
    nextContext: AddonContext,
  ) => void;
  setAgentAddonOutputType: (
    agentId: ID,
    instanceId: ID,
    nextType: OutputType,
  ) => void;
  setAgentAddonEnabled: (
    agentId: ID,
    instanceId: ID,
    enabled: boolean,
  ) => void;
  /** Agent-cortex counterpart of `setAddonJoinsPreviousStep`. */
  setAgentAddonJoinsPreviousStep: (
    agentId: ID,
    instanceId: ID,
    joins: boolean,
  ) => void;
  removeAgentAddon: (agentId: ID, instanceId: ID) => void;
  reorderAgentAddonInLane: (
    agentId: ID,
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
  /** Flip the crew's customer-facing published pointer. `null` unpublishes. */
  setPublishedCrewVersion: (agentId: ID, crewId: ID, versionId: ID | null) => void;
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
  /**
   * "Save all as" — create a brand-new version row on the agent
   * AND on every one of its crews, all sharing the same author-
   * provided description. The runtime ends up with one synchronised
   * snapshot across every entity, easily found later by scanning
   * any entity's version history for the shared name. Each entity
   * still gets its own version row + sync push (no batch endpoint).
   */
  saveAllVersionsAs: (agentId: ID, description?: string, opts?: SaveOpts) => void;
  /** Commit every unsaved entity (agent + dirty crews) into their current
   *  versions in one click. Clean entities are skipped. */
  saveAllVersions: (agentId: ID, opts?: SaveOpts) => void;
  setViewingAgentVersion: (agentId: ID, versionId: ID) => void;
  setActiveAgentVersion: (agentId: ID, versionId: ID) => void;
  /** Flip the agent's customer-facing published pointer. `null` unpublishes. */
  setPublishedAgentVersion: (agentId: ID, versionId: ID | null) => void;
  /** Publish the agent + every crew to their ACTIVE versions in one click. */
  publishAllVersions: (agentId: ID) => void;

  // ── Read-only version preview ──
  /** Transient preview state — non-null while browsing a non-active
   *  version read-only. `stashDirty` = whether the active line had
   *  unsaved edits when preview began (drives the Edit-this-version
   *  Save/Discard guard). */
  previewVersion: { agentId: ID; crewId: ID | null; versionId: ID; stashDirty: boolean } | null;
  /** Enter a read-only preview of a version (crew when crewId set, else agent). */
  enterPreview: (agentId: ID, crewId: ID | null, versionId: ID, stashDirty: boolean) => void;
  /** Leave preview, restoring the editable draft ("Back to active"). */
  exitPreview: () => void;
  /** Make the previewed version the editable line. Guard Save/Discard first. */
  editThisVersion: () => void;

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
   * "Reset to last saved state" — fetch the current server-side doc and
   * replace the working copy with it. If the server has no doc for this
   * slug yet, fall back to an empty agent shell so the user is left in
   * a usable initial state. Wired to the TopBar's single Reset button.
   *
   * Differs from `reloadProject` in that it has an empty fallback —
   * `reloadProject` is for Alfred-apply-style flows where a 404 is an
   * error to ignore. Here a 404 means "nothing saved yet, give me a
   * clean slate".
   */
  resetToServerState: () => Promise<void>;

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

  // Staged "starting values" (#765): field values the NEXT preview
  // conversation is born with. Edited in the Memory panel while no
  // conversation is active; UserChat passes them as `seedMemory` on
  // conversation create. Kept after use so replaying the same test
  // scenario is zero-effort (persist-until-changed).
  pendingSeeds: Record<string, { value: unknown; domain?: string }>;
  setPendingSeed: (field: string, value: unknown, domain?: string) => void;
  clearPendingSeed: (field: string) => void;

  // Live Brain — per-panel updates pushed live off the chat stream.
  // UserChat calls `applyLiveBrainPanel` on each `brain.panel` SSE event;
  // the Live Brain screen reads `liveBrainPanelEvent` and merges that one
  // panel into its preview (with its own animation). `seq` bumps every
  // push so the effect fires even for a repeat value. `panel: null`
  // clears/hides the panel. Reset when the preview conversation changes.
  liveBrainPanelEvent: { panelId: string; panel: LiveBrainPanelData | null; seq: number } | null;
  applyLiveBrainPanel: (panelId: string, panel: LiveBrainPanelData | null) => void;

  // Profiler — same per-panel live plumbing as the Live Brain, for the
  // Profiler authoring screen's preview. UserChat calls `applyProfilerPanel`
  // on each `profiler.panel` SSE event.
  profilerPanelEvent: { panelId: string; panel: LiveBrainPanelData | null; seq: number } | null;
  applyProfilerPanel: (panelId: string, panel: LiveBrainPanelData | null) => void;

  // Live brain state for the preview conversation. Two parallel
  // sections: `memory` (facts the brain remembers) and `thinking`
  // (the current strategic plan). FieldsPanel renders memory values
  // inline next to fields; the Thinking panel below the Cortex renders
  // its section as a card. Refetched after every chat turn.
  conversationMemory: {
    memory:   Record<string, Record<string, unknown>>;
    thinking: Record<string, Record<string, unknown>>;
    /** Summarizer slots — one entry per `config.name`. Written by
     *  offline-lane Summarizer addons. The brain viewer renders one
     *  card per slot; the prompt assembler substitutes
     *  `{{summary:NAME}}` with `slot.text`. */
    summary?: Record<string, { text: string; watermark: number; ranAt: number }>;
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
  /** The project doc, already loaded by BuilderApp. The provider
   *  initializes its working copy from a local draft (if any) falling
   *  back to this. Passing the loaded doc as a prop — instead of
   *  re-fetching inside the provider — keeps render 1 consistent: the
   *  selection state, draft persistence, and every other piece of
   *  state initialized from `doc` see the real shape, not a placeholder. */
  initialDoc: ProjectDoc;
  children: ReactNode;
}

export function BuilderProvider({ agentSlug, ownerUserId, initialDoc, children }: ProviderProps) {
  // The SERVER doc is the source of truth on load. The local draft is
  // honored only when it carries unsaved edits (its actual job) — a
  // clean draft is a stale cache and silently hid saves made from
  // other browsers/users with no way to refetch.
  const [doc, setDoc] = useState<ProjectDoc>(() => {
    const draft = loadDraft(agentSlug);
    return draft && draftHasUnsavedWork(draft) ? draft : initialDoc;
  });

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

  // ── Read-only version preview ──────────────────────────────────
  // Browsing a NON-active version shows it read-only WITHOUT disturbing
  // your editable draft: we stash the current doc, load the previewed
  // body into the working copy (so the canvas + test chat reflect it),
  // and FREEZE the localStorage autosave so your active-line draft is
  // preserved. Exiting restores the stash. Everything here is transient
  // client state — nothing about preview is persisted to the server.
  const previewStashRef = useRef<ProjectDoc | null>(null);
  const [previewVersion, setPreviewVersion] = useState<
    { agentId: ID; crewId: ID | null; versionId: ID; stashDirty: boolean } | null
  >(null);

  // Bridge to server-side persistence. The provider receives the
  // already-loaded doc as a prop, so this hook only owns the push
  // helpers used by mutations below.
  const sync: ProjectSyncApi = useProjectSync({
    agentSlug,
    ownerUserId,
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

  // Persist every change — EXCEPT while previewing a read-only version.
  // Freezing here keeps localStorage holding the active-line draft, so a
  // reload during preview restores your work (preview is transient), and
  // "Back to active" can restore the stashed draft cleanly.
  useEffect(() => {
    if (previewVersion) return;
    saveDraft(agentSlug, doc);
  }, [agentSlug, doc, previewVersion]);

  // Preview-chat conversation id, shared so the prompt-preview view
  // can fetch the real transcript instead of showing a placeholder.
  const [previewConversationId, setPreviewConversationId] = useState<number | null>(null);
  useEffect(() => { setPreviewConversationId(null); }, [agentSlug]);

  // Staged starting values for the NEXT preview conversation (#765).
  const [pendingSeeds, setPendingSeeds] = useState<Record<string, { value: unknown; domain?: string }>>({});
  useEffect(() => { setPendingSeeds({}); }, [agentSlug]);
  const setPendingSeed = useCallback((field: string, value: unknown, domain?: string) => {
    setPendingSeeds(prev => ({ ...prev, [field]: { value, domain } }));
  }, []);
  const clearPendingSeed = useCallback((field: string) => {
    setPendingSeeds(prev => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

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

  // Live Brain snapshot — the latest render-ready panel list pushed by
  // the chat stream (see `applyLiveBrainSnapshot`). Cleared when the
  // preview conversation changes so a newly-opened chat doesn't briefly
  // show the previous one's panels before its own first snapshot.
  const [liveBrainPanelEvent, setLiveBrainPanelEvent] =
    useState<{ panelId: string; panel: LiveBrainPanelData | null; seq: number } | null>(null);
  const applyLiveBrainPanel = useCallback((panelId: string, panel: LiveBrainPanelData | null) => {
    setLiveBrainPanelEvent(prev => ({ panelId, panel, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  useEffect(() => { setLiveBrainPanelEvent(null); }, [previewConversationId]);

  const [profilerPanelEvent, setProfilerPanelEvent] =
    useState<{ panelId: string; panel: LiveBrainPanelData | null; seq: number } | null>(null);
  const applyProfilerPanel = useCallback((panelId: string, panel: LiveBrainPanelData | null) => {
    setProfilerPanelEvent(prev => ({ panelId, panel, seq: (prev?.seq ?? 0) + 1 }));
  }, []);
  useEffect(() => { setProfilerPanelEvent(null); }, [previewConversationId]);

  // Live brain state for the preview conversation. The chat panel
  // calls refreshConversationMemory after each turn, and the
  // FieldsPanel + Thinking panels render values inline. The `summary`
  // section is optional on the wire (older servers won't return it);
  // the brain viewer treats a missing key as `{}`.
  const [conversationMemory, setConversationMemory] = useState<{
    memory:   Record<string, Record<string, unknown>>;
    thinking: Record<string, Record<string, unknown>>;
    summary?: Record<string, { text: string; watermark: number; ranAt: number }>;
    retrieval?: Record<string, string>;
  }>({ memory: {}, thinking: {}, summary: {}, retrieval: {} });
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
    (writes: Array<
      | {
          kind?: 'memory' | 'thinking';
          domain: string | null;
          field: string;
          value: unknown;
        }
      | {
          kind: 'memory' | 'thinking';
          domain: string | null;
          replace: true;
        }
      | {
          kind: 'retrieval';
          name: string;
          value?: unknown;
          clear?: boolean;
        }
    >) => {
      if (!Array.isArray(writes) || writes.length === 0) return;
      setConversationMemory(prev => {
        // Spread prev first so untouched sections (summary, retrieval)
        // survive this optimistic memory/thinking merge — otherwise the
        // Live Brain's Summaries/Knowledge flicker away until the
        // post-turn refresh restores them.
        const next = {
          ...prev,
          memory:    { ...prev.memory },
          thinking:  { ...prev.thinking },
          retrieval: { ...(prev.retrieval || {}) },
        };
        for (const w of writes) {
          // Retrieval — ephemeral KB slot. Update the Knowledge section
          // live; it has no field/domain, so it must NEVER fall through
          // to the memory path (that produced an `undefined` stale row).
          if ((w as { kind?: string }).kind === 'retrieval') {
            const rw = w as { name: string; value?: unknown; clear?: boolean };
            if (!rw.name) continue;
            if (rw.clear === true || rw.value === null || rw.value === undefined) {
              delete next.retrieval[rw.name];
            } else if (typeof rw.value === 'string') {
              next.retrieval[rw.name] = rw.value;
            }
            continue;
          }
          const dw = w as
            | { kind?: 'memory' | 'thinking'; domain: string | null; field: string; value: unknown }
            | { kind: 'memory' | 'thinking'; domain: string | null; replace: true };
          const section = dw.kind === 'thinking' ? 'thinking' : 'memory';
          const key = (dw.domain && String(dw.domain).trim()) ? String(dw.domain) : '_general';
          // Domain-replace marker — wipe the bucket then move on. The
          // server's `builderMemory.applyWrites` does the same, so the
          // optimistic local view matches the post-`done` refresh
          // (no two-phase "old keys linger, then disappear" flicker).
          if ('replace' in dw && dw.replace === true) {
            next[section][key] = {};
            continue;
          }
          // Narrowed: not a replace marker → value-write shape. Guard
          // against a missing field so a malformed write can't create an
          // `undefined` key.
          const vw = dw as { field: string; value: unknown };
          if (!vw.field) continue;
          if (vw.value === null || vw.value === undefined) continue;
          next[section][key] = { ...(next[section][key] || {}), [vw.field]: vw.value };
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
      setConversationMemory({ memory: {}, thinking: {}, summary: {} });
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
    (agentId: ID, patch: Partial<Pick<AgentDoc, 'name' | 'spec' | 'persona' | 'personas' | 'defaultCrewId' | 'fields' | 'domains' | 'tags' | 'parameters' | 'enums' | 'snippets' | 'liveBrain' | 'profiler' | 'triggers'>>) => {
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
          // ── Data side: re-declare the domain (dedup-preserving) and
          // sweep `FieldDef.domain` references across agent + crews.
          const declared = a.domains ?? [];
          const renamedDeclared = declared
            .map(x => (x === oldName ? newName : x))
            .filter((x, i, arr) => arr.indexOf(x) === i);
          const dataUpdated: AgentDoc = {
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
          // ── Token side: rewrite `{{memory:OLD}}` / `{{thinking:OLD}}`
          // in every prompt-text surface. Single atomic update so the
          // data + token sides stay consistent across React renders.
          return cascadeDomainTokens(dataUpdated, oldName, newName);
        }),
      }));
    },
    [],
  );

  /** Cascade field-name references across the agent doc. Delegates
   *  to the surface-aware renamers in `fieldRenameCascade.ts` so this
   *  mutator stays a thin atomic wrapper — when new surfaces start
   *  to store field names (prompts, snippets, persona), they get
   *  picked up automatically here. */
  const applyFieldRenameCascade = useCallback(
    (agentId: ID, oldName: string, newName: string) => {
      if (!oldName || !newName || oldName === newName) return;
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a =>
          a.id === agentId ? cascadeFieldRename(a, oldName, newName) : a,
        ),
      }));
    },
    [],
  );

  /**
   * Generic token-rename cascade. One entry point per entity kind so
   * call sites can do `applyTokenRenameCascade(agentId, 'persona', …)`
   * after writing the new name. The pure cascaders live in
   * `promptTokenCascade.ts`; this is the thin atomic-update wrapper.
   *
   * No-op when names are empty or equal — safe to call defensively
   * from every rename hook without pre-checking.
   */
  const applyTokenRenameCascade = useCallback(
    (
      agentId: ID,
      kind: 'enum' | 'persona' | 'snippet' | 'param' | 'summarizer' | 'tag' | 'kbDomain' | 'thinkingDomain',
      oldName: string,
      newName: string,
    ) => {
      if (!oldName || !newName || oldName === newName) return;
      const fn =
        kind === 'enum'           ? cascadeEnumNameRename :
        kind === 'persona'        ? cascadePersonaRename :
        kind === 'snippet'        ? cascadeSnippetRename :
        kind === 'param'          ? cascadeParameterRename :
        kind === 'tag'            ? cascadeTagRename :
        kind === 'kbDomain'       ? cascadeKbDomainTokens :
        kind === 'thinkingDomain' ? cascadeThinkingDomainTokens :
        /* kind === 'summarizer' */ cascadeSummarizerRename;
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a =>
          a.id === agentId ? fn(a, oldName, newName) : a,
        ),
      }));
    },
    [],
  );

  /**
   * Tag delete cascade — strips the tag from `agent.tags` and from
   * every `FieldDef.tags[]` across agent + crews. Tokens (`{{tag:N}}`)
   * are intentionally left in place so the broken reference is visible
   * to the author. Atomic doc update.
   */
  const removeAgentTag = useCallback(
    (agentId: ID, tagName: string) => {
      if (!tagName) return;
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a =>
          a.id === agentId ? deleteAgentTag(a, tagName) : a,
        ),
      }));
    },
    [],
  );

  /**
   * Enum-section rename — separate entry point because section renames
   * need (enumId, enumName) context to:
   *   - target `{{enum:EnumName:OLDSEC}}` to one enum, not all
   *   - find the FieldDefs bound to enumId so `{{dc:F:OLDSEC}}` can
   *     be rewritten for every F that resolves through this enum.
   */
  const applyEnumSectionRenameCascade = useCallback(
    (
      agentId: ID,
      enumId: ID,
      enumName: string,
      oldSection: string,
      newSection: string,
    ) => {
      if (!oldSection || !newSection || oldSection === newSection) return;
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a =>
          a.id === agentId
            ? cascadeEnumSectionRename(a, enumId, enumName, oldSection, newSection)
            : a,
        ),
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

  // Reorder the crew list (sidebar drag). `orderedCrewIds` is the full
  // new order; we reindex the crews array to match and persist the
  // positions. Visual only — doesn't affect the running/starting crew.
  const reorderCrews = useCallback((agentId: ID, orderedCrewIds: ID[]) => {
    setDoc(d => ({
      ...d,
      agents: d.agents.map(a => {
        if (a.id !== agentId) return a;
        const byId = new Map(a.crews.map(c => [c.id, c]));
        const reordered = orderedCrewIds
          .map(id => byId.get(id))
          .filter((c): c is CrewDoc => !!c);
        // Append any crew not in the provided list (defensive — keeps
        // every crew even if the caller's list is stale).
        for (const c of a.crews) if (!orderedCrewIds.includes(c.id)) reordered.push(c);
        return { ...a, crews: reordered };
      }),
    }));
    syncRef.current?.pushReorderCrews(agentId, orderedCrewIds);
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

  const setAddonJoinsPreviousStep = useCallback(
    (agentId: ID, crewId: ID, instanceId: ID, joins: boolean) => {
      mapCrew(agentId, crewId, c => ({
        ...c,
        addons: c.addons.map(a =>
          a.instanceId === instanceId ? { ...a, joinsPreviousStep: joins } : a,
        ),
      }));
    },
    [],
  );

  const removeAddon = useCallback((agentId: ID, crewId: ID, instanceId: ID) => {
    mapCrew(agentId, crewId, c => ({
      ...c,
      // normalizeMainStepFlags heals the parallel-step invariant: if the
      // removed addon was the leader of a group, the addon that now sits
      // first loses its dangling `joinsPreviousStep` (becomes its own
      // step). See draftStorage.normalizeMainStepFlags.
      addons: normalizeMainStepFlags(c.addons.filter(a => a.instanceId !== instanceId)),
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
        // Heal the invariant after a reorder — moving a join-flagged
        // addon to the front of the lane would otherwise leave it
        // dangling.
        return { ...c, addons: normalizeMainStepFlags(next) };
      });
    },
    [],
  );

  // ── Agent-cortex mutations ──
  //
  // Same mechanics as the crew counterparts above, scoped to
  // `agent.cortex`. Pulled out as a helper to keep the per-mutation
  // bodies readable.
  const mapAgent = (agentId: ID, fn: (a: AgentDoc) => AgentDoc) =>
    setDoc(d => ({
      ...d,
      agents: d.agents.map(a => (a.id === agentId ? fn(a) : a)),
    }));

  const addAgentAddon = useCallback((agentId: ID, instance: AddonInstance) => {
    mapAgent(agentId, a => ({ ...a, cortex: [...(a.cortex ?? []), instance] }));
  }, []);

  const updateAgentAddonConfig = useCallback(
    (agentId: ID, instanceId: ID, nextConfig: unknown) => {
      mapAgent(agentId, a => ({
        ...a,
        cortex: (a.cortex ?? []).map(x =>
          x.instanceId === instanceId ? { ...x, config: nextConfig } : x,
        ),
      }));
    },
    [],
  );

  const updateAgentAddonContext = useCallback(
    (agentId: ID, instanceId: ID, nextContext: AddonContext) => {
      mapAgent(agentId, a => ({
        ...a,
        cortex: (a.cortex ?? []).map(x =>
          x.instanceId === instanceId ? { ...x, context: nextContext } : x,
        ),
      }));
    },
    [],
  );

  const setAgentAddonOutputType = useCallback(
    (agentId: ID, instanceId: ID, nextType: OutputType) => {
      mapAgent(agentId, a => ({
        ...a,
        cortex: (a.cortex ?? []).map(x =>
          x.instanceId === instanceId ? { ...x, outputType: nextType } : x,
        ),
      }));
    },
    [],
  );

  const setAgentAddonEnabled = useCallback(
    (agentId: ID, instanceId: ID, enabled: boolean) => {
      mapAgent(agentId, a => ({
        ...a,
        cortex: (a.cortex ?? []).map(x =>
          x.instanceId === instanceId ? { ...x, enabled } : x,
        ),
      }));
    },
    [],
  );

  const setAgentAddonJoinsPreviousStep = useCallback(
    (agentId: ID, instanceId: ID, joins: boolean) => {
      mapAgent(agentId, a => ({
        ...a,
        cortex: (a.cortex ?? []).map(x =>
          x.instanceId === instanceId ? { ...x, joinsPreviousStep: joins } : x,
        ),
      }));
    },
    [],
  );

  const removeAgentAddon = useCallback((agentId: ID, instanceId: ID) => {
    mapAgent(agentId, a => ({
      ...a,
      cortex: normalizeMainStepFlags((a.cortex ?? []).filter(x => x.instanceId !== instanceId)),
    }));
  }, []);

  const reorderAgentAddonInLane = useCallback(
    (agentId: ID, lane: 'main' | 'background' | 'offline', fromIdx: number, toIdx: number) => {
      mapAgent(agentId, a => {
        const cortex = a.cortex ?? [];
        const positions: number[] = [];
        cortex.forEach((x, i) => { if (x.lane === lane) positions.push(i); });
        if (fromIdx < 0 || fromIdx >= positions.length) return a;
        if (toIdx   < 0 || toIdx   >= positions.length) return a;
        if (fromIdx === toIdx) return a;
        const reordered = [...positions];
        const [movedPos] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, movedPos);
        const next = [...cortex];
        positions.forEach((globalIdx, k) => {
          next[globalIdx] = cortex[reordered[k]];
        });
        return { ...a, cortex: normalizeMainStepFlags(next) };
      });
    },
    [],
  );

  /**
   * Move an addon to another container (crew or agent cortex, `null`
   * crewId = cortex) and/or lane, in ONE atomic doc update:
   *   - removed from its source (parallel-step flags healed there),
   *   - appended at the END of the destination container,
   *   - lane set; `joinsPreviousStep` reset (it arrives as its own step),
   *   - moving to the offline lane seeds a default "every 1 message"
   *     trigger when none is set — offline addons without a trigger
   *     never fire.
   * The caller (MoveAddonModal) enforces destination rules: only
   * main/offline lanes (background never runs), and no talker /
   * transition-router into the agent cortex (runtime forbids them).
   */
  const moveAddon = useCallback(
    (
      agentId: ID,
      instanceId: ID,
      from: { crewId: ID | null },
      to: { crewId: ID | null; lane: 'main' | 'offline' },
    ) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          const sourceList = from.crewId === null
            ? (a.cortex ?? [])
            : (a.crews.find(c => c.id === from.crewId)?.addons ?? []);
          const inst = sourceList.find(x => x.instanceId === instanceId);
          if (!inst) return a;

          const needsTrigger = to.lane === 'offline' && !inst.context?.trigger;
          const moved: AddonInstance = {
            ...inst,
            lane: to.lane,
            joinsPreviousStep: undefined,
            context: needsTrigger
              ? { ...inst.context, trigger: { kind: 'every_n_messages', n: 1 } }
              : inst.context,
          };

          let next: AgentDoc = a;
          // 1. Pluck from the source container.
          if (from.crewId === null) {
            next = {
              ...next,
              cortex: normalizeMainStepFlags((next.cortex ?? []).filter(x => x.instanceId !== instanceId)),
            };
          } else {
            next = {
              ...next,
              crews: next.crews.map(c => c.id === from.crewId
                ? { ...c, addons: normalizeMainStepFlags(c.addons.filter(x => x.instanceId !== instanceId)) }
                : c),
            };
          }
          // 2. Append to the destination container.
          if (to.crewId === null) {
            next = { ...next, cortex: [...(next.cortex ?? []), moved] };
          } else {
            next = {
              ...next,
              crews: next.crews.map(c => c.id === to.crewId
                ? { ...c, addons: [...c.addons, moved] }
                : c),
            };
          }
          return next;
        }),
      }));
    },
    [],
  );

  /**
   * Duplicate an addon into a destination container/lane — the same
   * picker as `moveAddon`, except the original stays put. The clone
   * gets a fresh instanceId, a " copy" suffix when the config carries
   * a user-visible name, and lands at the END of the destination
   * chain. Field Reasoner clones drop their `extractsFields` binding —
   * one field has ONE reasoner; the copy is re-bound deliberately.
   */
  const duplicateAddon = useCallback(
    (
      agentId: ID,
      instanceId: ID,
      from: { crewId: ID | null },
      to: { crewId: ID | null; lane: 'main' | 'offline' },
    ) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          const sourceList = from.crewId === null
            ? (a.cortex ?? [])
            : (a.crews.find(c => c.id === from.crewId)?.addons ?? []);
          const inst = sourceList.find(x => x.instanceId === instanceId);
          if (!inst) return a;

          const cfg = structuredClone(inst.config) as Record<string, unknown>;
          if (cfg && typeof cfg.name === 'string' && cfg.name.trim()) {
            cfg.name = `${cfg.name} copy`;
          }
          if (inst.pluginId === 'field-reasoner' && cfg && Array.isArray(cfg.extractsFields)) {
            cfg.extractsFields = [];
          }
          const context = structuredClone(inst.context);
          if (to.lane === 'offline' && !context?.trigger) {
            context.trigger = { kind: 'every_n_messages', n: 1 };
          }
          const clone: AddonInstance = {
            ...inst,
            instanceId: newAddonInstanceId(),
            lane: to.lane,
            joinsPreviousStep: undefined,
            config: cfg,
            context,
          };

          if (to.crewId === null) {
            return { ...a, cortex: [...(a.cortex ?? []), clone] };
          }
          return {
            ...a,
            crews: a.crews.map(c => c.id === to.crewId
              ? { ...c, addons: [...c.addons, clone] }
              : c),
          };
        }),
      }));
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
            // Merge EVERY AgentBody key — keep this list in sync with the
            // AgentBody Pick in types/index.ts. A key missing here means
            // Alfred's generated change for it is silently dropped (that's
            // exactly how liveBrain edits vanished before).
            agent = {
              ...a,
              ...(ab.name          !== undefined && { name: ab.name as string }),
              ...(ab.slug          !== undefined && { slug: ab.slug as string }),
              ...(ab.spec          !== undefined && { spec: ab.spec as string }),
              ...(ab.persona       !== undefined && { persona: ab.persona as string }),
              ...(ab.defaultCrewId !== undefined && { defaultCrewId: ab.defaultCrewId as ID | undefined }),
              ...(Array.isArray(ab.fields)     && { fields: ab.fields as AgentDoc['fields'] }),
              ...(Array.isArray(ab.domains)    && { domains: ab.domains as AgentDoc['domains'] }),
              ...(Array.isArray(ab.tags)       && { tags: ab.tags as AgentDoc['tags'] }),
              ...(Array.isArray(ab.parameters) && { parameters: ab.parameters as AgentDoc['parameters'] }),
              ...(Array.isArray(ab.enums)      && { enums: ab.enums as AgentDoc['enums'] }),
              ...(Array.isArray(ab.cortex)     && { cortex: ab.cortex as AgentDoc['cortex'] }),
              ...(Array.isArray(ab.snippets)   && { snippets: ab.snippets as AgentDoc['snippets'] }),
              ...(Array.isArray(ab.personas)   && { personas: ab.personas as AgentDoc['personas'] }),
              ...(ab.liveBrain !== undefined   && { liveBrain: ab.liveBrain as AgentDoc['liveBrain'] }),
              ...(ab.profiler !== undefined    && { profiler: ab.profiler as AgentDoc['profiler'] }),
              ...(ab.triggers !== undefined    && { triggers: ab.triggers as AgentDoc['triggers'] }),
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

  // Flip the PUBLISHED (customer-facing) pointer for one crew. Pass
  // versionId === null to unpublish. No effect on working copy, viewing,
  // or active.
  const setPublishedCrewVersion = useCallback(
    (agentId: ID, crewId: ID, versionId: ID | null) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          return {
            ...a,
            crews: a.crews.map(c => {
              if (c.id !== crewId) return c;
              if (versionId !== null && !c.versions.find(v => v.id === versionId)) return c;
              return { ...c, publishedVersionId: versionId };
            }),
          };
        }),
      }));
      syncRef.current?.pushSetCrewPublished(crewId, versionId);
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

  /** "Save all as" — create a NEW version row for the agent AND for
   *  every crew, all sharing the same description. The author
   *  picks one name; the runtime ends up with one synchronised
   *  snapshot across every entity. Returns the newly-created agent
   *  version (callers usually just want confirmation). */

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

  // ── Preview actions ────────────────────────────────────────────
  // Enter a read-only preview of `versionId` on an entity (crew when
  // crewId set, else the agent). Stash the current doc, load the
  // previewed body into the working copy for display + test chat.
  const enterPreview = useCallback(
    (agentId: ID, crewId: ID | null, versionId: ID, stashDirty: boolean) => {
      // Stash the editable draft ONLY on the first entry — switching
      // between previewed versions must not clobber it with a preview
      // body. Keep the original `stashDirty` across such switches.
      let firstEntry = false;
      if (!previewStashRef.current) {
        previewStashRef.current = docRef.current;
        firstEntry = true;
      }
      setPreviewVersion(prev =>
        prev && !firstEntry
          ? { ...prev, agentId, crewId, versionId }
          : { agentId, crewId, versionId, stashDirty },
      );
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          if (crewId) {
            return {
              ...a,
              crews: a.crews.map(c => {
                if (c.id !== crewId) return c;
                const target = c.versions.find(v => v.id === versionId);
                if (!target) return c;
                return { ...c, ...target.body, viewingVersionId: versionId };
              }),
            };
          }
          const target = a.versions.find(v => v.id === versionId);
          if (!target) return a;
          return { ...a, ...target.body, viewingVersionId: versionId };
        }),
      }));
    },
    [],
  );

  // Leave preview and restore the stashed editable draft. "Back to active".
  const exitPreview = useCallback(() => {
    const stash = previewStashRef.current;
    previewStashRef.current = null;
    setPreviewVersion(null);
    if (stash) setDoc(stash);
  }, []);

  // "Edit this version": make the previewed version your editable line.
  // The working copy already holds the previewed body (loaded on enter),
  // so we just move the ACTIVE pointer to it, drop the stash, and leave
  // preview — autosave resumes and persists the new active-line draft.
  // Caller is responsible for the Save/Discard guard when the old active
  // line had unsaved edits (see `previewVersion.stashDirty`).
  const editThisVersion = useCallback(() => {
    const p = previewVersion;
    if (!p) return;
    previewStashRef.current = null;
    setPreviewVersion(null);
    setDoc(d => ({
      ...d,
      agents: d.agents.map(a => {
        if (a.id !== p.agentId) return a;
        if (p.crewId) {
          return {
            ...a,
            crews: a.crews.map(c =>
              c.id === p.crewId ? { ...c, activeVersionId: p.versionId } : c,
            ),
          };
        }
        return { ...a, activeVersionId: p.versionId };
      }),
    }));
    if (p.crewId) syncRef.current?.pushSetCrewActive(p.crewId, p.versionId);
    else syncRef.current?.pushSetAgentActive(p.agentId, p.versionId);
  }, [previewVersion]);

  // Navigating to a different entity leaves any read-only preview and
  // restores the editable draft. Keyed on selection only (checks the
  // stash ref, not `previewVersion`, so entering preview doesn't
  // immediately fire this and self-cancel).
  useEffect(() => {
    if (previewStashRef.current) exitPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.level, selection.agentId, selection.crewId]);

  /** "Save all as" — create a brand-new version row on the agent
   *  AND on every crew with the same description. One shared
   *  snapshot name across every entity so the version log reads as
   *  a single named checkpoint when you scan a crew's history later.
   *  Implemented as a sequential call into the per-entity `…As`
   *  savers so each entity's mutation, sync push, and apply-log
   *  handling stays single-purpose. */
  const saveAllVersionsAs = useCallback((agentId: ID, description?: string, opts?: SaveOpts) => {
    const d = docRef.current;
    const agent = d.agents.find(a => a.id === agentId);
    if (!agent) return;
    saveAgentVersionAs(agentId, description, opts);
    for (const c of agent.crews ?? []) {
      saveCrewVersionAs(agentId, c.id, description, opts);
    }
  }, [saveAgentVersionAs, saveCrewVersionAs]);

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

  // Flip the agent's PUBLISHED (customer-facing) pointer. `null`
  // unpublishes (runtime falls back to active→viewing).
  const setPublishedAgentVersion = useCallback(
    (agentId: ID, versionId: ID | null) => {
      setDoc(d => ({
        ...d,
        agents: d.agents.map(a => {
          if (a.id !== agentId) return a;
          if (versionId !== null && !a.versions.find(v => v.id === versionId)) return a;
          return { ...a, publishedVersionId: versionId };
        }),
      }));
      syncRef.current?.pushSetAgentPublished(agentId, versionId);
    },
    [],
  );

  // One-click "ship everything to customers": publish the agent's
  // ACTIVE version and every crew's ACTIVE version. Active is the
  // builder's canonical selection; this promotes the whole set to live
  // in a single render + one push per entity.
  const publishAllVersions = useCallback((agentId: ID) => {
    const d = docRef.current;
    const agent = d.agents.find(a => a.id === agentId);
    if (!agent) return;
    setDoc(prev => ({
      ...prev,
      agents: prev.agents.map(a => {
        if (a.id !== agentId) return a;
        return {
          ...a,
          publishedVersionId: a.activeVersionId,
          crews: a.crews.map(c => ({ ...c, publishedVersionId: c.activeVersionId })),
        };
      }),
    }));
    syncRef.current?.pushSetAgentPublished(agentId, agent.activeVersionId);
    for (const c of agent.crews) {
      syncRef.current?.pushSetCrewPublished(c.id, c.activeVersionId);
    }
  }, []);

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

  // Commit-in-place counterpart of saveAllVersionsAs: save every UNSAVED
  // entity (the agent + each dirty crew) into its current version, in one
  // click. Only dirty entities are touched — clean ones are skipped so we
  // don't churn timestamps or write no-op versions. Declared after
  // isAgentDirty/isCrewDirty so its dependency array doesn't hit their TDZ.
  const saveAllVersions = useCallback((agentId: ID, opts?: SaveOpts) => {
    const d = docRef.current;
    const agent = d.agents.find(a => a.id === agentId);
    if (!agent) return;
    if (isAgentDirty(agentId)) saveAgentVersion(agentId, opts);
    for (const c of agent.crews ?? []) {
      if (isCrewDirty(agentId, c.id)) saveCrewVersion(agentId, c.id, opts);
    }
  }, [isAgentDirty, isCrewDirty, saveAgentVersion, saveCrewVersion]);

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

  const resetToServerState = useCallback(async () => {
    // Bulletproof Reset: wipe the local draft AND hard-reload. We used
    // to do clearDraft + fetchProject + setDoc, but the in-memory React
    // state (doc ref, autosave hook, dirty calc, useEffect persistence
    // of doc back to localStorage) gave the user a thousand ways to
    // see "dirty" right after Reset. Reload sidesteps all of them —
    // every cache, every ref, every effect starts from scratch and
    // BuilderApp's initial fetchProject is the single source of truth.
    clearDraft(agentSlug);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [agentSlug]);

  const value = useMemo<BuilderState>(
    () => ({
      doc,
      selection,
      setSelection,
      updateProject,
      updateAgent,
      renameAgentDomain,
      applyFieldRenameCascade,
      applyTokenRenameCascade,
      applyEnumSectionRenameCascade,
      removeAgentTag,
      addCrew,
      removeCrew,
      reorderCrews,
      updateCrew,
      addAddon,
      updateAddonConfig,
      updateAddonContext,
      setAddonOutputType,
      setAddonEnabled,
      setAddonJoinsPreviousStep,
      removeAddon,
      reorderAddonInLane,
      moveAddon,
      duplicateAddon,
      addAgentAddon,
      updateAgentAddonConfig,
      updateAgentAddonContext,
      setAgentAddonOutputType,
      setAgentAddonEnabled,
      setAgentAddonJoinsPreviousStep,
      removeAgentAddon,
      reorderAgentAddonInLane,
      saveCrewVersion,
      saveCrewVersionAs,
      setViewingCrewVersion,
      setActiveCrewVersion,
      setPublishedCrewVersion,
      discardCrewChanges,
      deleteCrewVersion,
      isCrewDirty,
      saveAgentVersion,
      saveAgentVersionAs,
      saveAllVersionsAs,
      saveAllVersions,
      setViewingAgentVersion,
      setActiveAgentVersion,
      setPublishedAgentVersion,
      publishAllVersions,
      previewVersion,
      enterPreview,
      exitPreview,
      editThisVersion,
      discardAgentChanges,
      deleteAgentVersion,
      isAgentDirty,
      resetDraft,
      reloadProject,
      resetToServerState,
      pendingAlfredApply,
      applyAlfredBodies,
      previewConversationId,
      setPreviewConversationId,
      pendingSeeds,
      setPendingSeed,
      clearPendingSeed,
      liveBrainPanelEvent,
      applyLiveBrainPanel,
      profilerPanelEvent,
      applyProfilerPanel,
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
      applyFieldRenameCascade,
      applyTokenRenameCascade,
      applyEnumSectionRenameCascade,
      removeAgentTag,
      addCrew,
      removeCrew,
      reorderCrews,
      updateCrew,
      addAddon,
      updateAddonConfig,
      updateAddonContext,
      setAddonOutputType,
      setAddonEnabled,
      setAddonJoinsPreviousStep,
      removeAddon,
      reorderAddonInLane,
      moveAddon,
      duplicateAddon,
      addAgentAddon,
      updateAgentAddonConfig,
      updateAgentAddonContext,
      setAgentAddonOutputType,
      setAgentAddonEnabled,
      setAgentAddonJoinsPreviousStep,
      removeAgentAddon,
      reorderAgentAddonInLane,
      saveCrewVersion,
      saveCrewVersionAs,
      setViewingCrewVersion,
      setActiveCrewVersion,
      setPublishedCrewVersion,
      discardCrewChanges,
      deleteCrewVersion,
      isCrewDirty,
      saveAgentVersion,
      saveAgentVersionAs,
      saveAllVersionsAs,
      saveAllVersions,
      setViewingAgentVersion,
      setActiveAgentVersion,
      setPublishedAgentVersion,
      publishAllVersions,
      previewVersion,
      enterPreview,
      exitPreview,
      editThisVersion,
      discardAgentChanges,
      deleteAgentVersion,
      isAgentDirty,
      resetDraft,
      reloadProject,
      resetToServerState,
      pendingAlfredApply,
      applyAlfredBodies,
      previewConversationId,
      pendingSeeds,
      liveBrainPanelEvent,
      applyLiveBrainPanel,
      profilerPanelEvent,
      applyProfilerPanel,
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
