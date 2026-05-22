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
import { FIELD_EXTRACTOR_PLUGIN_ID } from '../plugins/fieldExtractor/addon.fieldExtractor';
import type { AddonInstance, FieldExtractorConfig, ID } from '../types';
import type { CrewDomain, CrewField, ExtractorRef } from './useCrewFields';

function isFieldExtractor(a: AddonInstance): a is AddonInstance<FieldExtractorConfig> {
  return a.pluginId === FIELD_EXTRACTOR_PLUGIN_ID;
}

export function useAgentFields(agentId: ID) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  // Every Field Extractor across the agent, with display labels that
  // prefer the user-set `config.name`.
  const agentExtractors = useMemo<ExtractorRef[]>(() => {
    if (!agent) return [];
    const out: ExtractorRef[] = [];
    for (const crew of agent.crews) {
      const fxs = crew.addons.filter(isFieldExtractor);
      fxs.forEach((e, i) => {
        const userName = (e.config?.name || '').trim();
        const fallback = fxs.length === 1 ? 'Field Extractor' : `Field Extractor #${i + 1}`;
        out.push({
          instanceId: e.instanceId,
          label: userName || fallback,
          crewId: crew.id,
          crewName: crew.name,
        });
      });
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
          if (!isFieldExtractor(a)) continue;
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

  const domainNames = useMemo<string[]>(
    () => domains.filter(d => d.name !== null).map(d => d.name as string),
    [domains],
  );

  return {
    agentExtractors,
    allFields,
    domains,
    domainNames,
  };
}
