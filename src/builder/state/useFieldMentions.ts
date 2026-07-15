/**
 * useFieldnameMentions — heuristic "who else writes this field?" scan.
 *
 * Structured extractors declare their fields via `extractsFields`, so
 * the Fields panels can show exactly who collects what. Free-prompt
 * addons (Thinker above all) have no such wiring — but the runtime
 * auto-harvests ANY returned JSON attribute whose name matches a
 * declared field. The one strong signal we DO have is the
 * `{{fieldname:NAME}}` token in an addon's prompt: it interpolates the
 * field's NAME (not its value), which you practically only do when
 * asking the model to return that attribute. Not a guarantee — hence
 * the chips these refs feed render as "likely", visually softer than
 * the structured ones.
 *
 * Known gap (accepted): tokens hidden inside `{{snippet:...}}` bodies
 * are not scanned.
 */

import { useMemo } from 'react';
import { useBuilder } from './BuilderContext';
import { getPlugin } from '../registry/plugins';
import type { AddonInstance, ID } from '../types';

export interface FieldMentionRef {
  instanceId: ID;
  pluginId: string;
  /** Instance name when the user set one, else the plugin's name. */
  label: string;
  icon: string;
  /** Owning crew's name; null = the agent cortex. */
  crewName: string | null;
}

const FIELDNAME_TOKEN = /\{\{\s*fieldname\s*:\s*([^}\s]+)\s*\}\}/g;

/** Field names referenced via {{fieldname:…}} in this addon's prompt. */
function fieldNamesInPrompt(a: AddonInstance): string[] {
  const prompt = (a.config as { prompt?: unknown } | undefined)?.prompt;
  if (typeof prompt !== 'string' || !prompt.includes('fieldname')) return [];
  const names = new Set<string>();
  for (const m of prompt.matchAll(FIELDNAME_TOKEN)) names.add(m[1]);
  return [...names];
}

/**
 * Map of field NAME → addons whose prompt references it via
 * `{{fieldname:NAME}}`. Consumers filter out refs that the field
 * already lists as a structured extractor (no duplicate chips).
 */
export function useFieldnameMentions(agentId: ID): Map<string, FieldMentionRef[]> {
  const { doc } = useBuilder();
  return useMemo(() => {
    const map = new Map<string, FieldMentionRef[]>();
    const agent = doc.agents.find(a => a.id === agentId);
    if (!agent) return map;

    const visit = (addons: AddonInstance[] | undefined, crewName: string | null) => {
      for (const a of addons ?? []) {
        const names = fieldNamesInPrompt(a);
        if (names.length === 0) continue;
        const plugin = getPlugin(a.pluginId);
        const cfg = a.config as { name?: unknown } | undefined;
        const ref: FieldMentionRef = {
          instanceId: a.instanceId,
          pluginId: a.pluginId,
          label: (typeof cfg?.name === 'string' && cfg.name.trim()) || plugin?.name || a.pluginId,
          icon: plugin?.icon ?? '🧩',
          crewName,
        };
        for (const n of names) {
          const list = map.get(n) ?? [];
          list.push(ref);
          map.set(n, list);
        }
      }
    };

    visit(agent.cortex, null);
    for (const c of agent.crews) visit(c.addons, c.name);
    return map;
  }, [doc, agentId]);
}
