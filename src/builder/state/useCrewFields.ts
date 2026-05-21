/**
 * useCrewFields — selector + mutation hook for crew-level fields.
 *
 * Fields are physically owned by Field Extractor addon instances
 * (lives inside `addon.config.fields`). This hook aggregates them
 * to a flat list for the crew dashboard, tagging each with the
 * extractor instance that produces it.
 *
 * Mutations write back through `updateAddonConfig` so the data
 * model stays normalized (extractor produces fields).
 */

import { useCallback, useMemo } from 'react';
import { useBuilder, newAddonInstanceId } from './BuilderContext';
import { FIELD_EXTRACTOR_PLUGIN_ID, fieldExtractorPlugin } from '../plugins/fieldExtractor';
import { defaultContextFor, defaultOutputTypeFor } from '../registry/plugins';
import type {
  AddonInstance,
  FieldDef,
  FieldExtractorConfig,
  ID,
} from '../types';

export interface CrewField {
  field: FieldDef;
  extractorInstanceId: ID;
  /** Human-readable label for the source extractor instance. */
  extractorLabel: string;
}

export interface ExtractorOption {
  instanceId: ID;
  label: string;
}

/** A domain present in the crew (i.e. tagged on at least one field). */
export interface CrewDomain {
  /** Domain name. `null` denotes "(no domain)". */
  name: string | null;
  /** Fields tagged with this domain. */
  fields: CrewField[];
}

function isFieldExtractor(a: AddonInstance): a is AddonInstance<FieldExtractorConfig> {
  return a.pluginId === FIELD_EXTRACTOR_PLUGIN_ID;
}

function newFieldId(): ID {
  return `field_${Math.random().toString(36).slice(2, 9)}`;
}

export function useCrewFields(agentId: ID, crewId: ID) {
  const { doc, updateAddonConfig, addAddon } = useBuilder();

  const agent = doc.agents.find(a => a.id === agentId);
  const crew = agent?.crews.find(c => c.id === crewId);

  const extractors = useMemo<AddonInstance<FieldExtractorConfig>[]>(
    () => (crew?.addons ?? []).filter(isFieldExtractor),
    [crew?.addons],
  );

  const extractorOptions = useMemo<ExtractorOption[]>(
    () =>
      extractors.map((e, i) => ({
        instanceId: e.instanceId,
        label: extractors.length === 1 ? 'Field Extractor' : `Field Extractor #${i + 1}`,
      })),
    [extractors],
  );

  const allFields = useMemo<CrewField[]>(() => {
    const labelFor = (id: ID) =>
      extractorOptions.find(o => o.instanceId === id)?.label ?? 'Field Extractor';
    const out: CrewField[] = [];
    for (const e of extractors) {
      for (const f of e.config.fields) {
        out.push({
          field: f,
          extractorInstanceId: e.instanceId,
          extractorLabel: labelFor(e.instanceId),
        });
      }
    }
    return out;
  }, [extractors, extractorOptions]);

  /**
   * Distinct domains present in this crew. Named domains come first
   * in field-add order; "(no domain)" appears last as `name: null`
   * if any field is domainless.
   */
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

  /** Bare list of named domains in this crew (no `(no domain)`). */
  const domainNames = useMemo<string[]>(
    () => domains.filter(d => d.name !== null).map(d => d.name as string),
    [domains],
  );

  const addField = useCallback(
    (extractorInstanceId: ID, draft: Omit<FieldDef, 'id'>): FieldDef => {
      const target = extractors.find(e => e.instanceId === extractorInstanceId);
      if (!target) throw new Error('Target extractor not found');
      const field: FieldDef = { ...draft, id: newFieldId() };
      const nextConfig: FieldExtractorConfig = {
        ...target.config,
        fields: [...target.config.fields, field],
      };
      updateAddonConfig(agentId, crewId, extractorInstanceId, nextConfig);
      return field;
    },
    [agentId, crewId, extractors, updateAddonConfig],
  );

  /**
   * Add a field to the crew, creating a Field Extractor if none exists.
   * If `extractorInstanceId` is supplied it targets that one; otherwise
   * the first extractor (or a newly-created one) receives the field.
   * Combined into a single mutation so the create-then-add race
   * around batched setState can't lose the field.
   */
  const addFieldToCrew = useCallback(
    (draft: Omit<FieldDef, 'id'>, extractorInstanceId?: ID): FieldDef => {
      const field: FieldDef = { ...draft, id: newFieldId() };
      const target = extractorInstanceId
        ? extractors.find(e => e.instanceId === extractorInstanceId)
        : extractors[0];

      if (target) {
        const nextConfig: FieldExtractorConfig = {
          ...target.config,
          fields: [...target.config.fields, field],
        };
        updateAddonConfig(agentId, crewId, target.instanceId, nextConfig);
        return field;
      }

      // No extractor — create one with the field already inside.
      const instance: AddonInstance<FieldExtractorConfig> = {
        instanceId: newAddonInstanceId(),
        pluginId: FIELD_EXTRACTOR_PLUGIN_ID,
        lane: fieldExtractorPlugin.defaultLane,
        enabled: true,
        config: { ...fieldExtractorPlugin.defaultConfig(), fields: [field] },
        context: defaultContextFor(fieldExtractorPlugin),
        outputType: defaultOutputTypeFor(fieldExtractorPlugin),
        promptTemplate: fieldExtractorPlugin.defaultPromptTemplate,
      };
      addAddon(agentId, crewId, instance as AddonInstance);
      return field;
    },
    [agentId, crewId, extractors, updateAddonConfig, addAddon],
  );

  const updateField = useCallback(
    (extractorInstanceId: ID, fieldId: ID, patch: Partial<FieldDef>) => {
      const target = extractors.find(e => e.instanceId === extractorInstanceId);
      if (!target) return;
      const nextConfig: FieldExtractorConfig = {
        ...target.config,
        fields: target.config.fields.map(f => (f.id === fieldId ? { ...f, ...patch } : f)),
      };
      updateAddonConfig(agentId, crewId, extractorInstanceId, nextConfig);
    },
    [agentId, crewId, extractors, updateAddonConfig],
  );

  const removeField = useCallback(
    (extractorInstanceId: ID, fieldId: ID) => {
      const target = extractors.find(e => e.instanceId === extractorInstanceId);
      if (!target) return;
      const nextConfig: FieldExtractorConfig = {
        ...target.config,
        fields: target.config.fields.filter(f => f.id !== fieldId),
      };
      updateAddonConfig(agentId, crewId, extractorInstanceId, nextConfig);
    },
    [agentId, crewId, extractors, updateAddonConfig],
  );

  /** Move a field between extractor instances (re-parent). */
  const moveField = useCallback(
    (fieldId: ID, fromInstanceId: ID, toInstanceId: ID) => {
      if (fromInstanceId === toInstanceId) return;
      const from = extractors.find(e => e.instanceId === fromInstanceId);
      const to = extractors.find(e => e.instanceId === toInstanceId);
      if (!from || !to) return;
      const field = from.config.fields.find(f => f.id === fieldId);
      if (!field) return;
      const fromConfig: FieldExtractorConfig = {
        ...from.config,
        fields: from.config.fields.filter(f => f.id !== fieldId),
      };
      const toConfig: FieldExtractorConfig = {
        ...to.config,
        fields: [...to.config.fields, field],
      };
      updateAddonConfig(agentId, crewId, fromInstanceId, fromConfig);
      updateAddonConfig(agentId, crewId, toInstanceId, toConfig);
    },
    [agentId, crewId, extractors, updateAddonConfig],
  );

  return {
    extractors,
    extractorOptions,
    allFields,
    domains,
    domainNames,
    addField,
    addFieldToCrew,
    updateField,
    removeField,
    moveField,
  };
}
