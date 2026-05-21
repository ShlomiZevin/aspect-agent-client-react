/**
 * Builder JSON document types.
 *
 * Storage model: each ProjectDoc / AgentDoc / CrewDoc is a single JSON
 * document persisted as one row in its own table (later). During the
 * builder session they live in memory and localStorage as drafts.
 *
 * Plugin configs live INSIDE the crew doc as opaque `config` blobs keyed
 * by `pluginId`. The plugin registry knows how to render/validate each.
 */

export type ID = string;

// ─── Provider / Model ──────────────────────────────────────────────

export interface ModelRef {
  providerId: string;
  modelId: string;
}

// ─── Fields (used by Field Extractor and any future addon that produces fields) ──

export type FieldType = 'string' | 'int' | 'enum' | 'boolean';

/** Where a field value comes from. */
export type FieldSource =
  | 'explicit'   // only when the user literally says it
  | 'inferred';  // can be concluded from conversation patterns

export interface FieldDef {
  id: ID;
  name: string;                 // canonical key, snake_case
  type: FieldType;
  source: FieldSource;
  /** Free-text guidance on how to extract this field. */
  howToExtract: string;
  /** Only for `type: 'enum'`. */
  enumValues?: string[];
  /**
   * Optional memory grouping. Blank/undefined = "(no domain)" — the
   * field is still captured to a `general` bucket at runtime, just
   * not surfaced under a named group.
   */
  domain?: string;
}

// ─── Addons (plugins inside a crew) ────────────────────────────────

/**
 * Where an addon instance runs. Chosen by the user when adding the
 * instance — not a fixed property of the plugin. A single plugin
 * (e.g. Field Extractor) may run in different lanes in different
 * crews.
 */
export type AddonLane = 'main' | 'background' | 'offline';

/**
 * How much past conversation to inject into the step's prompt.
 *  - `none`   — no history.
 *  - `last_n` — last N messages (n is set in the same object).
 *  - `full`   — entire conversation transcript.
 *
 * Future addition (when a Summarizer plugin ships): `summary` mode
 * that reads from the conversation summary field in memory.
 */
export interface HistoryMode {
  mode: 'none' | 'last_n' | 'full';
  /** Only meaningful when `mode === 'last_n'`. */
  n?: number;
}

/**
 * Universal reading knobs every addon has, regardless of plugin.
 * Persona default OFF (user opts in). Memory reads default empty
 * (user opts in). History default = `last_n: 5`.
 */
export interface AddonContext {
  history: HistoryMode;
  /** Inject the agent persona into the prompt. Default off. */
  persona: boolean;
  /**
   * List of memory domains to inject. `null` denotes "(no domain)".
   * Empty list = no `## Memory` section in the prompt.
   */
  memoryReads: Array<string | null>;
}

/**
 * What this addon produces at runtime. Conceptually independent
 * from how it produces it — kept extensible so future plugins can
 * declare new kinds (UI cards, audio, tool calls, …).
 */
export type OutputType =
  | 'text-to-user'      // Talker — text response sent to the chat
  | 'json-to-memory';   // Field Extractor, future Strategic / Vibe — structured fields written to memory

export interface AddonInstance<TConfig = unknown> {
  /** Unique within the crew. */
  instanceId: ID;
  /** Refers to a registered plugin (e.g. "field-extractor"). */
  pluginId: string;
  /** Lane this instance runs in. Set per-instance by the user. */
  lane: AddonLane;
  enabled: boolean;
  /** Plugin-defined config blob. */
  config: TConfig;
  /** Universal reading knobs (history / persona / memory). */
  context: AddonContext;
  /**
   * What this instance produces — chosen from the plugin's
   * `allowedOutputTypes` list. Default snapshotted from
   * `defaultOutputType` at create time. User-configurable.
   */
  outputType: OutputType;
  /**
   * Prompt template the runtime uses to assemble this step's prompt.
   * Snapshotted from the plugin's `defaultPromptTemplate` at create
   * time so it travels with the addon and stays stable across plugin
   * updates. Placeholders are interpolated by the runtime — see
   * `KNOWN_PROMPT_PLACEHOLDERS` below for the full set.
   *
   * Source-of-truth contract: this exact string is what the server
   * uses as the *prompt* parameter to the LLM. **History is NOT in
   * this string** — it's passed separately as the LLM's message-
   * history parameter (varies per provider).
   */
  promptTemplate: string;
}

/**
 * Placeholders the runtime substitutes when assembling a step's
 * prompt. Only things that go INTO the prompt belong here.
 * Conversation history and the latest user message are runtime
 * concerns sent to the LLM as separate parameters, not interpolated.
 */
export const KNOWN_PROMPT_PLACEHOLDERS = {
  /** The user-written prompt (`config.prompt`). */
  prompt: '{{prompt}}',
  /** Agent persona text. Empty string when `context.persona` is false. */
  persona: '{{persona}}',
  /** `## Memory` block built from `context.memoryReads`. Empty if none. */
  memory: '{{memory}}',
  /**
   * `## Field schema` block — fields with name, type, allowed enum
   * values, source, and description. Extractor plugins only.
   */
  fields_schema: '{{fields_schema}}',
  /**
   * `## Already collected` block — JSON map of current field values
   * (nulls included). Extractor plugins only.
   */
  fields_current: '{{fields_current}}',
} as const;

// ─── Plugin-specific config shapes ─────────────────────────────────

export interface FieldExtractorConfig {
  prompt: string;
  model: ModelRef;
  fields: FieldDef[];
}

export interface TalkerConfig {
  /** The voice prompt — what the crew is supposed to say and how. */
  prompt: string;
  model: ModelRef;
}

// ─── The three-level documents ─────────────────────────────────────

/**
 * The editable fields of a crew — the body that gets snapshotted into
 * a `CrewVersion`. Same fields live at the top of `CrewDoc` as the
 * "working copy" (what the user is currently editing).
 */
export type CrewBody = Pick<
  CrewDoc,
  'name' | 'description' | 'spec' | 'persona' | 'addons'
>;

export interface CrewVersion {
  id: ID;
  /** Monotonic, starting at 1. */
  number: number;
  /** Optional human-readable label from Save As. */
  description?: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Frozen snapshot of the crew body at save time. */
  body: CrewBody;
}

export interface CrewDoc {
  id: ID;
  // ── Working copy (currently editable state — tracks the *viewing* version) ──
  name: string;
  description?: string;
  spec: string;
  persona?: string;
  /**
   * Ordered list of addons attached to this crew. The chain of addons
   * IS the crew's behaviour — including the Talker addon, which owns
   * the response prompt. The crew itself has no prompt of its own.
   */
  addons: AddonInstance[];
  // ── Versioning ──
  versions: CrewVersion[];
  /**
   * The version the agent actually runs at runtime. Server-side
   * persistence will read this as a column on the crew row. Only
   * changes when the user clicks "Set as active" — never when they
   * switch which version they're viewing/editing.
   */
  activeVersionId: ID;
  /**
   * The version currently loaded into the working copy (top-level
   * fields). The user can switch between versions to view/edit
   * different snapshots without changing what's active.
   * Defaults to the active version when a new crew is created.
   */
  viewingVersionId: ID;
}

/**
 * Editable fields of an agent — the body that gets snapshotted into
 * an `AgentVersion`. Crews are intentionally excluded: they're their
 * own versioned entities with independent histories. Crew membership
 * stays at the top of `AgentDoc`, outside the version body.
 */
export type AgentBody = Pick<
  AgentDoc,
  'name' | 'slug' | 'spec' | 'persona' | 'defaultCrewId'
>;

export interface AgentVersion {
  id: ID;
  number: number;
  description?: string;
  createdAt: string;
  body: AgentBody;
}

export interface AgentDoc {
  id: ID;
  /** URL slug used by /:agent/builder routes. */
  slug: string;
  /** Working copy of the agent name (tracks the viewing version). */
  name: string;
  /** Free-text spec at the agent level. */
  spec: string;
  /** Persona shared across all crews. */
  persona: string;
  defaultCrewId?: ID;
  /**
   * The crews that belong to this agent. NOT part of the agent
   * version body — crews are their own versioned entities and live
   * here as siblings of the version history.
   */
  crews: CrewDoc[];
  /** Snapshot history of the agent body (persona, spec, name, …). */
  versions: AgentVersion[];
  /** The version the runtime uses. Promoted explicitly via "Set as active". */
  activeVersionId: ID;
  /** The version currently loaded into the working copy. */
  viewingVersionId: ID;
}

/**
 * Shared shape for a version's metadata. Both `CrewVersion` and
 * `AgentVersion` satisfy it. Used by the generic version UI
 * components (pill + toolbar) so they can render either kind.
 */
export interface VersionMeta {
  id: ID;
  number: number;
  description?: string;
  createdAt: string;
}

export interface ProjectDoc {
  id: ID;
  name: string;
  /** Free-text spec at the project level. */
  spec: string;
  agents: AgentDoc[];
}

/** Pointer to which slice of the doc the user is currently editing. */
export interface BuilderSelection {
  level: 'project' | 'agent' | 'crew';
  agentId?: ID;
  crewId?: ID;
}
