/**
 * useCrewFields — fields *visible* in a single crew's view.
 *
 * In the new field model, definitions live on `agent.fields[]` (when
 * scope='agent') and `crew.fields[]` (when scope='crew'). Extractors
 * hold an `extractsFields: ID[]` list — which definitions they pull.
 *
 * The crew view should show every field a user editing this crew
 * cares about — that's every agent field PLUS this crew's own
 * crew-scoped fields. Each `CrewField` carries `scope` (derived from
 * its storage location), `extractors` (every Field Extractor across
 * the agent that has this field in its `extractsFields`), and a
 * primary extractor label for legacy "single owner" code paths.
 *
 * Mutations:
 *   - addField:       create a FieldDef in agent.fields or crew.fields
 *                     AND register it in each selected extractor's
 *                     `extractsFields` list.
 *   - updateField:    patch a FieldDef in its storage location.
 *                     Setting scope moves the def between agent/crew.
 *   - removeField:    delete the FieldDef AND scrub its id from every
 *                     extractor's `extractsFields` (no orphan refs).
 *   - setFieldExtractors: replace the set of extractors that extract
 *                     a given field id (multi-toggle from the editor).
 */

import { useCallback, useMemo } from 'react';
import { useBuilder, newAddonInstanceId } from './BuilderContext';
import { FIELD_EXTRACTOR_PLUGIN_ID, fieldExtractorPlugin } from '../plugins/fieldExtractor/addon.fieldExtractor';
import { defaultContextFor, defaultOutputTypeFor, getPlugin } from '../registry/plugins';
import type {
  AddonInstance,
  AgentDoc,
  CrewDoc,
  FieldDef,
  FieldExtractorConfig,
  FieldScope,
  ID,
} from '../types';

export interface ExtractorRef {
  /** Extractor-class addon instance id. */
  instanceId: ID;
  /** Plugin id of the extractor (e.g. 'field-extractor', 'vibe-extractor').
   *  Lets the UI tell extractor *flavors* apart without a name parse. */
  pluginId: string;
  /** Plugin's display icon — used as a leading glyph in row chips. */
  icon: string;
  /** User-set name (extractor's `config.name`) or a plugin-specific
   *  fallback like "Vibe Extractor #2". */
  label: string;
  /** Crew the extractor lives in. */
  crewId: ID;
  /** Crew's display name (for "Crew → Extractor" labels). */
  crewName: string;
}

export interface CrewField {
  field: FieldDef;
  /** Where the field lives (which array it was found in). */
  scope: FieldScope;
  /**
   * The crew this field belongs to when scope='crew'. Empty string
   * when scope='agent' (the field has no owning crew).
   */
  ownerCrewId: ID;
  /**
   * Every Field Extractor across the agent that lists this field's
   * id in its `extractsFields`. Empty means the field is defined
   * but nothing extracts it (the UI flags this as a configuration
   * issue).
   */
  extractors: ExtractorRef[];
  // ── Legacy single-extractor fields kept for compat with existing
  // ── modal code. These point at the first entry in `extractors`,
  // ── or empty when there are none.
  extractorInstanceId: ID;
  extractorLabel: string;
  /**
   * Crew the field is being VIEWED from. Matches `ownerCrewId` for
   * crew-scoped fields; for agent-scoped fields, it's the crew the
   * panel is rendered inside (used by the editor to know which
   * crew's extractors to show in the "Extracted by" multi-select).
   */
  crewId: ID;
  crewName: string;
}

export interface ExtractorOption {
  instanceId: ID;
  label: string;
}

/** A domain present in the field set. */
export interface CrewDomain {
  /** Domain name. `null` denotes "(no domain)". */
  name: string | null;
  fields: CrewField[];
}

/**
 * Is this addon an extractor-class plugin? Any plugin whose descriptor
 * sets `fieldMode: 'extractor'` counts (Field Extractor, Vibe Extractor,
 * and any future siblings). Generalized via the plugin registry so new
 * extractor flavors are picked up automatically — no per-call-site
 * pluginId list to maintain.
 *
 * The `FieldExtractorConfig` type cast is sound because every extractor-
 * mode plugin shares the same config shape (`extractsFields[]`, prompt,
 * model, optional name). Future extractor plugins must stick to that
 * shape for memory writes to flow through the engine uniformly.
 */
function isExtractor(a: AddonInstance): a is AddonInstance<FieldExtractorConfig> {
  return getPlugin(a.pluginId)?.fieldMode === 'extractor';
}

function newFieldId(): ID {
  return `field_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Single source of truth for "where do extractor-class addons live
 * in this agent". Yields every extractor instance with its owning
 * container tagged: `crewId === null` means the addon lives on
 * `agent.cortex` (runs before any crew); otherwise it's the id of
 * the crew whose `addons[]` it lives in. The display name in
 * `crewName` follows the same split — `"Agent"` for cortex, the
 * crew's name otherwise.
 *
 * Every site that walks all extractors in an agent (the picker, the
 * "extracted by" lookup, the bulk-toggle, the delete-time scrub)
 * consults this helper. That way the "where do addons live"
 * knowledge sits in one place — if we ever add another container
 * (project cortex, etc.) it's one update, not five.
 */
interface ExtractorWalkEntry {
  instance: AddonInstance<FieldExtractorConfig>;
  /** `null` → lives on `agent.cortex`. Otherwise the crew's id. */
  crewId: ID | null;
  /** Display name of the owning container — `"Agent"` for cortex. */
  crewName: string;
}

export const AGENT_CORTEX_LABEL = 'Agent';

export function walkExtractorsInAgent(agent: AgentDoc | undefined): ExtractorWalkEntry[] {
  if (!agent) return [];
  const out: ExtractorWalkEntry[] = [];
  for (const a of agent.cortex ?? []) {
    if (isExtractor(a)) out.push({ instance: a, crewId: null, crewName: AGENT_CORTEX_LABEL });
  }
  for (const crew of agent.crews) {
    for (const a of crew.addons) {
      if (isExtractor(a)) out.push({ instance: a, crewId: crew.id, crewName: crew.name });
    }
  }
  return out;
}

/**
 * Build a labeled list of all extractor-class addon instances in an
 * agent (cortex + every crew). Labels prefer the user-set
 * `config.name`, falling back to "<Plugin name> [#N]" disambiguated
 * **per container** so the Vibe Extractors and Field Extractors don't
 * collide visually within the same crew (or the agent cortex).
 */
export function listAllExtractors(agent: AgentDoc | undefined): ExtractorRef[] {
  if (!agent) return [];
  // Group walk entries by their container so the "#N" suffix only
  // numbers among siblings of the same flavor inside the same
  // container — "Vibe Extractor #1" counts independently from
  // "Field Extractor #1" within one crew, and the agent cortex has
  // its own counter family.
  const byContainer = new Map<string, ExtractorWalkEntry[]>();
  for (const entry of walkExtractorsInAgent(agent)) {
    const key = entry.crewId ?? '__agent__';
    if (!byContainer.has(key)) byContainer.set(key, []);
    byContainer.get(key)!.push(entry);
  }

  const out: ExtractorRef[] = [];
  for (const entries of byContainer.values()) {
    const byPluginTotal = new Map<string, number>();
    for (const e of entries) {
      byPluginTotal.set(e.instance.pluginId, (byPluginTotal.get(e.instance.pluginId) || 0) + 1);
    }
    const byPluginCount = new Map<string, number>();
    for (const { instance: a, crewId, crewName } of entries) {
      const pluginDesc = getPlugin(a.pluginId);
      const userName = (a.config?.name || '').trim();
      const pluginName = pluginDesc?.name || 'Extractor';
      const totalOfKind = byPluginTotal.get(a.pluginId) || 1;
      const idx = (byPluginCount.get(a.pluginId) || 0) + 1;
      byPluginCount.set(a.pluginId, idx);
      const fallback = totalOfKind === 1 ? pluginName : `${pluginName} #${idx}`;
      out.push({
        instanceId: a.instanceId,
        pluginId:   a.pluginId,
        icon:       pluginDesc?.icon || '🛠',
        label:      userName || fallback,
        // The ExtractorRef shape predates agent cortex; we use `''`
        // (empty string) as the agent-cortex sentinel here so the
        // interface stays a plain `ID` for crewId. Consumers that
        // matter (FieldEditorModal, AddFieldModal) only group by
        // crewName, so the empty crewId is invisible to them.
        crewId:     crewId ?? '',
        crewName,
      });
    }
  }
  return out;
}

/**
 * Build a CrewField for a given FieldDef, populating `extractors`
 * by scanning every Field Extractor in the agent for the field id.
 */
function buildCrewField(
  def: FieldDef,
  scope: FieldScope,
  ownerCrewId: ID,
  viewedCrewId: ID,
  viewedCrewName: string,
  agentExtractors: ExtractorRef[],
  agent: AgentDoc | undefined,
): CrewField {
  if (!agent) {
    return {
      field: def,
      scope,
      ownerCrewId,
      extractors: [],
      extractorInstanceId: '',
      extractorLabel: '',
      crewId: viewedCrewId,
      crewName: viewedCrewName,
    };
  }
  // Resolve which extractors mention this id — walks cortex + every
  // crew so an agent-cortex-only extraction shows up here too.
  const extractors: ExtractorRef[] = [];
  for (const { instance: a } of walkExtractorsInAgent(agent)) {
    const list = Array.isArray(a.config.extractsFields) ? a.config.extractsFields : [];
    if (list.includes(def.id)) {
      const ref = agentExtractors.find(x => x.instanceId === a.instanceId);
      if (ref) extractors.push(ref);
    }
  }
  return {
    field: def,
    scope,
    ownerCrewId,
    extractors,
    extractorInstanceId: extractors[0]?.instanceId ?? '',
    extractorLabel:      extractors[0]?.label      ?? '',
    crewId: viewedCrewId,
    crewName: viewedCrewName,
  };
}

export function useCrewFields(agentId: ID, crewId: ID) {
  const {
    doc, updateAgent, updateCrew, updateAddonConfig, updateAgentAddonConfig, addAddon,
    applyFieldRenameCascade,
  } = useBuilder();

  const agent = doc.agents.find(a => a.id === agentId);
  const crew = agent?.crews.find(c => c.id === crewId);
  // The agent-cortex context — when the hook is called with an empty
  // crewId, the consumer is editing an agent-cortex extractor, not a
  // crew-scoped one. We branch a few memos on this so the "this
  // container's extractors" view sources from `agent.cortex` instead
  // of a crew's `addons[]`.
  const isAgentContext = crewId === '' && !!agent;

  const agentExtractors = useMemo(() => listAllExtractors(agent), [agent]);

  /** Extractors that live in the CURRENT container — the crew the
   *  consumer is viewing, or the agent cortex when invoked at agent
   *  scope. Used by the "this extractor" picker in AddFieldModal. */
  const extractors = useMemo<AddonInstance<FieldExtractorConfig>[]>(
    () => (
      isAgentContext
        ? (agent?.cortex ?? []).filter(isExtractor)
        : (crew?.addons ?? []).filter(isExtractor)
    ),
    [isAgentContext, agent?.cortex, crew?.addons],
  );

  const extractorOptions = useMemo<ExtractorOption[]>(
    () => extractors.map((e, i) => {
      const userName = (e.config?.name || '').trim();
      const fallback = extractors.length === 1 ? 'Field Extractor' : `Field Extractor #${i + 1}`;
      return { instanceId: e.instanceId, label: userName || fallback };
    }),
    [extractors],
  );

  /**
   * Every field visible in this view. At crew scope: agent fields +
   * this crew's crew-scoped fields. At agent scope (no `crewId`): just
   * the agent fields — crew-scoped fields aren't reachable when you're
   * editing an agent-cortex addon. The order is agent-first (stable),
   * then crew-scoped.
   */
  const allFields = useMemo<CrewField[]>(() => {
    if (!agent) return [];
    const viewedCrewId  = crew?.id ?? '';
    const viewedCrewName = crew?.name ?? AGENT_CORTEX_LABEL;
    const out: CrewField[] = [];
    for (const def of agent.fields || []) {
      out.push(buildCrewField(def, 'agent', '', viewedCrewId, viewedCrewName, agentExtractors, agent));
    }
    if (crew) {
      for (const def of crew.fields || []) {
        out.push(buildCrewField(def, 'crew', crew.id, viewedCrewId, viewedCrewName, agentExtractors, agent));
      }
    }
    return out;
  }, [agent, crew, agentExtractors]);

  const domains = useMemo<CrewDomain[]>(() => {
    const named = new Map<string, CrewField[]>();
    const orphan: CrewField[] = [];
    for (const cf of allFields) {
      const d = cf.field.domain?.trim();
      if (d) {
        if (!named.has(d)) named.set(d, []);
        named.get(d)!.push(cf);
      } else {
        orphan.push(cf);
      }
    }
    const out: CrewDomain[] = [...named.entries()].map(([name, fields]) => ({ name, fields }));
    if (orphan.length > 0) out.push({ name: null, fields: orphan });
    return out;
  }, [allFields]);

  // Union of in-use domains + declared-but-empty ones on the agent.
  // The latter ensures the DomainInput autocomplete can suggest a
  // declared domain before any field has been slotted into it.
  const domainNames = useMemo<string[]>(() => {
    const inUse = domains.filter(d => d.name !== null).map(d => d.name as string);
    const declared = agent?.domains ?? [];
    const set = new Set<string>([...inUse, ...declared]);
    return Array.from(set).sort();
  }, [domains, agent?.domains]);

  /**
   * Register a field id in the `extractsFields` lists of the named
   * extractor instances (and remove from any not in `extractorIds`).
   * Used by add + edit flows.
   */
  const setFieldExtractors = useCallback(
    (fieldId: ID, extractorIds: ID[]) => {
      if (!agent) return;
      const wanted = new Set(extractorIds);
      // For each extractor across the agent (cortex + every crew),
      // decide if it should contain the id and patch its config when
      // changed. The dispatch picks the right updater: crew-scoped
      // addons go through `updateAddonConfig`, agent-cortex ones
      // through `updateAgentAddonConfig`.
      for (const { instance: a, crewId: ownerCrewId } of walkExtractorsInAgent(agent)) {
        const list = Array.isArray(a.config.extractsFields) ? a.config.extractsFields : [];
        const has = list.includes(fieldId);
        const should = wanted.has(a.instanceId);
        if (has === should) continue;
        const next = should
          ? [...list, fieldId]
          : list.filter(id => id !== fieldId);
        const nextConfig: FieldExtractorConfig = { ...a.config, extractsFields: next };
        if (ownerCrewId === null) {
          updateAgentAddonConfig(agentId, a.instanceId, nextConfig);
        } else {
          updateAddonConfig(agentId, ownerCrewId, a.instanceId, nextConfig);
        }
      }
    },
    [agent, agentId, updateAddonConfig, updateAgentAddonConfig],
  );

  /**
   * Add a field to the agent or crew (per `scope`), then register
   * it in each of the supplied extractor instance ids.
   * Creates a Field Extractor automatically if `extractorIds` is
   * empty AND `createDefaultExtractor` is true — preserves the old
   * "just add a field" UX.
   */
  const addFieldToScope = useCallback(
    (
      scope: FieldScope,
      draft: Omit<FieldDef, 'id'>,
      extractorIds: ID[],
      opts?: { createDefaultExtractor?: boolean },
    ): FieldDef => {
      const field: FieldDef = { ...draft, id: newFieldId() };
      // Write the def into the right body.
      if (scope === 'agent') {
        const next = [...(agent?.fields || []), field];
        updateAgent(agentId, { fields: next } as Partial<AgentDoc>);
      } else {
        const next = [...(crew?.fields || []), field];
        updateCrew(agentId, crewId, { fields: next } as Partial<CrewDoc>);
      }
      // If the user picked no extractors AND we're invited to bootstrap
      // one, mint a Field Extractor in this crew and use it.
      let ids = extractorIds;
      if (ids.length === 0 && opts?.createDefaultExtractor) {
        const instance: AddonInstance<FieldExtractorConfig> = {
          instanceId: newAddonInstanceId(),
          pluginId: FIELD_EXTRACTOR_PLUGIN_ID,
          lane: fieldExtractorPlugin.defaultLane,
          enabled: true,
          config: { ...fieldExtractorPlugin.defaultConfig(), extractsFields: [field.id] },
          context: defaultContextFor(fieldExtractorPlugin),
          outputType: defaultOutputTypeFor(fieldExtractorPlugin),
          promptTemplate: fieldExtractorPlugin.defaultPromptTemplate,
        };
        addAddon(agentId, crewId, instance as AddonInstance);
        ids = [instance.instanceId];
      } else if (ids.length > 0) {
        setFieldExtractors(field.id, ids);
      }
      return field;
    },
    [agent, crew, agentId, crewId, updateAgent, updateCrew, addAddon, setFieldExtractors],
  );

  /**
   * Patch a FieldDef. If `nextScope` differs from the current scope,
   * the def is moved between agent.fields and crew.fields.
   */
  const updateField = useCallback(
    (currentScope: FieldScope, currentOwnerCrewId: ID, fieldId: ID,
     patch: Partial<FieldDef>, nextScope?: FieldScope) => {
      if (!agent) return;
      const targetScope = nextScope ?? currentScope;
      const moving = targetScope !== currentScope;

      // Find + remove from current location.
      let original: FieldDef | undefined;
      if (currentScope === 'agent') {
        original = (agent.fields || []).find(f => f.id === fieldId);
        if (!original) return;
      } else {
        const c = agent.crews.find(x => x.id === currentOwnerCrewId);
        original = (c?.fields || []).find(f => f.id === fieldId);
        if (!original || !c) return;
      }

      // ── Rename cascade ──
      // When the patch renames the field, sweep every place that
      // stores the OLD name (transition conditions, addon filters,
      // and — once wired — prompt/snippet/persona token bodies)
      // BEFORE we change the FieldDef itself. Done first so downstream
      // readers never see a window with a renamed FieldDef but stale
      // references pointing at it. The cascade is a no-op when the
      // name isn't changing.
      if (patch.name && patch.name.trim() !== original.name.trim()) {
        applyFieldRenameCascade(agentId, original.name, patch.name.trim());
      }

      if (currentScope === 'agent') {
        if (moving) {
          const remaining = (agent.fields || []).filter(f => f.id !== fieldId);
          updateAgent(agentId, { fields: remaining } as Partial<AgentDoc>);
        } else {
          const next = (agent.fields || []).map(f => f.id === fieldId ? { ...f, ...patch } : f);
          updateAgent(agentId, { fields: next } as Partial<AgentDoc>);
        }
      } else {
        const c = agent.crews.find(x => x.id === currentOwnerCrewId);
        original = (c?.fields || []).find(f => f.id === fieldId);
        if (!original || !c) return;
        if (moving) {
          const remaining = (c.fields || []).filter(f => f.id !== fieldId);
          updateCrew(agentId, c.id, { fields: remaining } as Partial<CrewDoc>);
        } else {
          const next = (c.fields || []).map(f => f.id === fieldId ? { ...f, ...patch } : f);
          updateCrew(agentId, c.id, { fields: next } as Partial<CrewDoc>);
        }
      }

      // If moving, insert at the destination with the patch applied.
      if (moving) {
        const patched: FieldDef = { ...original, ...patch };
        if (targetScope === 'agent') {
          const next = [...(agent.fields || []), patched];
          updateAgent(agentId, { fields: next } as Partial<AgentDoc>);
        } else {
          // Moving to crew → use the *viewing* crew as the new owner.
          const next = [...((crew?.fields) || []), patched];
          updateCrew(agentId, crewId, { fields: next } as Partial<CrewDoc>);
        }
      }
    },
    [agent, crew, agentId, crewId, updateAgent, updateCrew],
  );

  /**
   * Delete a field definition AND scrub its id from every extractor
   * that referenced it (no orphan ids left over).
   */
  const removeField = useCallback(
    (scope: FieldScope, ownerCrewId: ID, fieldId: ID) => {
      if (!agent) return;
      if (scope === 'agent') {
        const next = (agent.fields || []).filter(f => f.id !== fieldId);
        updateAgent(agentId, { fields: next } as Partial<AgentDoc>);
      } else {
        const c = agent.crews.find(x => x.id === ownerCrewId);
        if (!c) return;
        const next = (c.fields || []).filter(f => f.id !== fieldId);
        updateCrew(agentId, c.id, { fields: next } as Partial<CrewDoc>);
      }
      // Scrub — drop the id from every extractor across cortex + crews.
      for (const { instance: a, crewId: ownerCrewId } of walkExtractorsInAgent(agent)) {
        const list = Array.isArray(a.config.extractsFields) ? a.config.extractsFields : [];
        if (!list.includes(fieldId)) continue;
        const nextConfig: FieldExtractorConfig = {
          ...a.config,
          extractsFields: list.filter(id => id !== fieldId),
        };
        if (ownerCrewId === null) {
          updateAgentAddonConfig(agentId, a.instanceId, nextConfig);
        } else {
          updateAddonConfig(agentId, ownerCrewId, a.instanceId, nextConfig);
        }
      }
    },
    [agent, agentId, updateAgent, updateCrew, updateAddonConfig, updateAgentAddonConfig],
  );

  return {
    extractors,
    extractorOptions,
    agentExtractors,
    allFields,
    domains,
    domainNames,
    addFieldToScope,
    setFieldExtractors,
    updateField,
    removeField,
  };
}
