/**
 * useAgentFields — fields visible on the AGENT view.
 *
 * Shows only agent-scoped fields (those stored on `AgentDoc.fields`).
 * Crew-scoped fields are intentionally hidden here — they only show
 * up in their owning crew's view.
 *
 * Returns the same `CrewField` shape `useCrewFields` does so the
 * FieldsPanel can render either source without branching.
 */

import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import { getPlugin } from '../registry/plugins';
import type { AddonInstance, FieldExtractorConfig, ID } from '../types';
import type { CrewDomain, CrewField, ExtractorRef } from './useCrewFields';

/**
 * Any plugin with `fieldMode: 'extractor'` counts — Field Extractor,
 * Vibe Extractor, and future siblings. Generalized via the registry
 * so new extractor flavors are picked up automatically.
 */
function isExtractor(a: AddonInstance): a is AddonInstance<FieldExtractorConfig> {
  return getPlugin(a.pluginId)?.fieldMode === 'extractor';
}

export function useAgentFields(agentId: ID) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  // Every extractor-class addon across the agent, with display labels
  // that prefer the user-set `config.name`. The "#N" suffix is scoped
  // per-plugin-per-crew so Vibe and Field number independently.
  const agentExtractors = useMemo<ExtractorRef[]>(() => {
    if (!agent) return [];
    const out: ExtractorRef[] = [];
    for (const crew of agent.crews) {
      const byPluginTotal = new Map<string, number>();
      const byPluginCount = new Map<string, number>();
      for (const a of crew.addons) {
        if (!isExtractor(a)) continue;
        byPluginTotal.set(a.pluginId, (byPluginTotal.get(a.pluginId) || 0) + 1);
      }
      for (const a of crew.addons) {
        if (!isExtractor(a)) continue;
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
          crewId:     crew.id,
          crewName:   crew.name,
        });
      }
    }
    return out;
  }, [agent]);

  const allFields = useMemo<CrewField[]>(() => {
    if (!agent) return [];
    return (agent.fields || []).map<CrewField>(def => {
      // Resolve which extractors mention this id.
      const extractors: ExtractorRef[] = [];
      for (const crew of agent.crews) {
        for (const a of crew.addons) {
          if (!isExtractor(a)) continue;
          const list = Array.isArray(a.config.extractsFields) ? a.config.extractsFields : [];
          if (list.includes(def.id)) {
            const ref = agentExtractors.find(x => x.instanceId === a.instanceId);
            if (ref) extractors.push(ref);
          }
        }
      }
      return {
        field: def,
        scope: 'agent',
        ownerCrewId: '',
        extractors,
        extractorInstanceId: extractors[0]?.instanceId ?? '',
        extractorLabel:      extractors[0]?.label      ?? '',
        // No viewed crew on the agent view; left empty.
        crewId: '',
        crewName: '',
      };
    });
  }, [agent, agentExtractors]);

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

  // Union of in-use domains + declared-but-empty ones on the agent
  // (parallel to useCrewFields).
  const domainNames = useMemo<string[]>(() => {
    const inUse = domains.filter(d => d.name !== null).map(d => d.name as string);
    const declared = agent?.domains ?? [];
    const set = new Set<string>([...inUse, ...declared]);
    return Array.from(set).sort();
  }, [domains, agent?.domains]);

  return {
    agentExtractors,
    allFields,
    domains,
    domainNames,
  };
}
