/**
 * useAgentFields — fields visible on the AGENT view.
 *
 * Shows only agent-scoped fields (those stored on `AgentDoc.fields`).
 * Crew-scoped fields are intentionally hidden here — they only show
 * up in their owning crew's view.
 *
 * Returns the same `CrewField` shape `useCrewFields` does so the
 * FieldsPanel can render either source without branching.
 *
 * Extractor scanning is delegated to `walkExtractorsInAgent` /
 * `listAllExtractors` (exported from `useCrewFields.ts`) — that's the
 * single source of truth for "where do extractor-class addons live"
 * (cortex + every crew). Without sharing those helpers, this hook
 * would silently miss every agent-cortex extractor / Field Reasoner
 * and flag their target fields as "unwired" in the SchemaPanel.
 */

import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import {
  AGENT_CORTEX_LABEL,
  listAllExtractors,
  walkExtractorsInAgent,
  type CrewDomain,
  type CrewField,
  type ExtractorRef,
} from './useCrewFields';
import type { ID } from '../types';

export function useAgentFields(agentId: ID) {
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  // Every extractor-class addon across the agent (cortex + every
  // crew), labeled the same way useCrewFields labels them. Sharing
  // the helper guarantees a single `#N` numbering scheme everywhere.
  const agentExtractors = useMemo<ExtractorRef[]>(
    () => listAllExtractors(agent),
    [agent],
  );

  const allFields = useMemo<CrewField[]>(() => {
    if (!agent) return [];
    return (agent.fields || []).map<CrewField>(def => {
      // Resolve which extractors mention this id — walks cortex +
      // every crew so a cortex-only extraction or a Field Reasoner
      // in the agent cortex still counts as "wired".
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
        scope: 'agent',
        ownerCrewId: '',
        extractors,
        extractorInstanceId: extractors[0]?.instanceId ?? '',
        extractorLabel:      extractors[0]?.label      ?? '',
        // No viewed crew on the agent view; we label it with the
        // agent-cortex placeholder so downstream consumers that show
        // the "viewed-from" container have something readable.
        crewId: '',
        crewName: AGENT_CORTEX_LABEL,
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

  // Union of in-use tags (collected across every field) and declared
  // tags on `agent.tags`. The TagsInput uses this to autocomplete.
  // Walks agent + crew fields so a crew-scoped field's tag stays
  // visible in the agent-scope picker.
  const tagNames = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const f of agent?.fields ?? []) {
      for (const t of f.tags ?? []) set.add(t);
    }
    for (const c of agent?.crews ?? []) {
      for (const f of c.fields ?? []) {
        for (const t of f.tags ?? []) set.add(t);
      }
    }
    for (const t of agent?.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [agent?.fields, agent?.crews, agent?.tags]);

  return {
    agentExtractors,
    allFields,
    domains,
    domainNames,
    tagNames,
  };
}
