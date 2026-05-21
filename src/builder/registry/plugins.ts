/**
 * Plugin registry — the contract every addon implements, plus a tiny
 * runtime registry the builder consults to render config UI, debug
 * views, and (later) execute the addon against a live conversation.
 *
 * A "plugin" is a class of addon (e.g. "field-extractor"). Inside a
 * crew, the user can have many `AddonInstance`s of the same plugin,
 * each with its own config.
 */

import type { ComponentType } from 'react';
import type { AddonContext, AddonInstance, AddonLane, FieldSource, ID, OutputType } from '../types';

/** Props passed to a plugin's config component. */
export interface PluginConfigProps<TConfig = unknown> {
  config: TConfig;
  onChange: (next: TConfig) => void;
  /** The instance this config belongs to — read-only metadata. */
  instance: AddonInstance<TConfig>;
  /** Owning agent id — useful for plugin UIs that need crew context. */
  agentId: ID;
  /** Owning crew id — useful for plugin UIs that need crew context. */
  crewId: ID;
}

/** Props for a plugin's runtime debug view (shown next to the user chat). */
export interface PluginDebugProps<TConfig = unknown> {
  config: TConfig;
  /** Future: list of activity events this plugin emitted this turn. */
  activity?: unknown[];
}

/** Re-export so callers don't have to dual-import. */
export type PluginLane = AddonLane;

/**
 * Whether this plugin produces fields (and therefore auto-injects
 * field schema + already-collected values into its prompt).
 *
 *  - 'none' — does not produce fields (e.g. Talker).
 *  - 'extractor' — produces fields via its config (Field Extractor,
 *    future Vibe Extractor / Thinker).
 */
export type PluginFieldMode = 'none' | 'extractor';

export interface PluginDescriptor<TConfig = unknown> {
  /** Stable id used in `AddonInstance.pluginId`. */
  id: string;
  /** Human-readable name shown in the add-addon picker. */
  name: string;
  /** One-line description for the picker. */
  description: string;
  /** Emoji or short symbol for dense UI. */
  icon: string;
  /** Accent colour (CSS value) for cards / chips. */
  color: string;
  /**
   * Suggested lane when the user adds this plugin without picking one
   * (e.g. when a field add implicitly creates an extractor). The user
   * can always override per-instance.
   */
  defaultLane: AddonLane;
  /** Factory: returns the default config blob for a new instance. */
  defaultConfig: () => TConfig;
  /**
   * Default reading-knobs (history / persona / memory). Merged with
   * the global default if not specified.
   */
  defaultContext?: Partial<AddonContext>;
  /**
   * The exact prompt template a fresh instance gets. Snapshotted
   * into `AddonInstance.promptTemplate` at create time so the
   * client preview and the server runtime always agree on the
   * string. Uses placeholders from `KNOWN_PROMPT_PLACEHOLDERS`.
   */
  defaultPromptTemplate: string;
  /**
   * Whether this plugin produces fields, and how. Drives UI hints in
   * the Output info block (auto-injected schema + values).
   */
  fieldMode?: PluginFieldMode;
  /**
   * Which field sources are allowed when *this plugin* produces a
   * field. Defaults to both. Vibe-style extractors typically only
   * allow 'inferred'.
   */
  allowedFieldSources?: FieldSource[];
  /** Whether this plugin speaks to the user. Default: false. */
  speaks?: boolean;
  /**
   * Output types the user can pick from in the Output section.
   * Defaults to `['json-to-memory']` if not specified. For plugins
   * where the user shouldn't actually pick (e.g. Talker), this is
   * still a single-element list so the UI is consistent.
   */
  allowedOutputTypes?: OutputType[];
  /** Initial output type for new instances. Must be in `allowedOutputTypes`. */
  defaultOutputType?: OutputType;
  /** Config-screen component. */
  ConfigComponent: ComponentType<PluginConfigProps<TConfig>>;
  /** Optional live-activity view rendered next to the user chat. */
  DebugComponent?: ComponentType<PluginDebugProps<TConfig>>;
}

/** Sensible defaults for any new addon instance. */
export const DEFAULT_ADDON_CONTEXT: AddonContext = {
  history: { mode: 'last_n', n: 5 },
  persona: false,
  memoryReads: [],
};

/**
 * Resolve a plugin's effective default context, applying its
 * `defaultContext` overrides on top of the global default.
 *
 * Generic over the plugin's config type so call sites can pass a
 * concretely-typed descriptor (e.g. `PluginDescriptor<TalkerConfig>`)
 * without invariance complaints from the `ConfigComponent` field.
 */
export function defaultContextFor<TConfig>(plugin: PluginDescriptor<TConfig>): AddonContext {
  return {
    ...DEFAULT_ADDON_CONTEXT,
    ...(plugin.defaultContext ?? {}),
    history: plugin.defaultContext?.history ?? DEFAULT_ADDON_CONTEXT.history,
    memoryReads: plugin.defaultContext?.memoryReads ?? DEFAULT_ADDON_CONTEXT.memoryReads,
  };
}

/** Resolve the initial `outputType` for a fresh instance of this plugin. */
export function defaultOutputTypeFor<TConfig>(plugin: PluginDescriptor<TConfig>): OutputType {
  if (plugin.defaultOutputType) return plugin.defaultOutputType;
  if (plugin.allowedOutputTypes && plugin.allowedOutputTypes.length > 0) {
    return plugin.allowedOutputTypes[0];
  }
  // Speakers default to text-to-user; everyone else to json-to-memory.
  return plugin.speaks ? 'text-to-user' : 'json-to-memory';
}

// ─── Registry ──────────────────────────────────────────────────────

const REGISTRY = new Map<string, PluginDescriptor<unknown>>();

export function registerPlugin<TConfig>(descriptor: PluginDescriptor<TConfig>): void {
  if (REGISTRY.has(descriptor.id)) {
    throw new Error(`Plugin already registered: ${descriptor.id}`);
  }
  REGISTRY.set(descriptor.id, descriptor as PluginDescriptor<unknown>);
}

export function getPlugin(pluginId: string): PluginDescriptor<unknown> | undefined {
  return REGISTRY.get(pluginId);
}

export function listPlugins(): PluginDescriptor<unknown>[] {
  return [...REGISTRY.values()];
}

export function listPluginsByDefaultLane(lane: AddonLane): PluginDescriptor<unknown>[] {
  return listPlugins().filter(p => p.defaultLane === lane);
}
