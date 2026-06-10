/**
 * AddonContextSection — runtime conversation settings for the addon.
 *
 * The History dropdown covers every supported `HistoryMode`:
 *
 *   - `none`              — no history
 *   - `last_n`            — last 3 / 5 / 10 messages (canned values)
 *   - `all` / `full`      — full conversation (`full` is the legacy
 *                            alias rendered the same as `all`)
 *   - `since_transition`  — messages strictly after the last crew
 *                            transition
 *   - `since_summarizer`  — messages after the named summarizer's
 *                            last watermark
 *
 * The UI uses ONE flat dropdown rather than a kind + sub-picker
 * because every entry expands to a fully-determined `HistoryMode`.
 * `since_summarizer` produces one entry per declared summarizer name
 * across the agent (cortex + every crew); if the user reads a long
 * agent, the dropdown groups summarizer entries at the bottom under a
 * separator so the static modes stay scannable at the top.
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useAddonMutations } from '../../state/useAddonMutations';
import { InlineField } from '../AddonModal/InlineField';
import type { AddonContext, AddonInstance, HistoryMode, ID } from '../../types';
import styles from './AddonContextSection.module.css';

const SUMMARIZER_PLUGIN_ID = 'summarizer';

interface Props {
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
  instance: AddonInstance;
}

/** Encode a HistoryMode into a flat string value for the <select>. */
function encodeMode(mode: HistoryMode): string {
  switch (mode.mode) {
    case 'none':              return 'none';
    case 'last_n':            return `last_n:${mode.n}`;
    case 'all':               return 'all';
    case 'full':              return 'all';                                     // legacy alias collapses to `all` in the picker
    case 'since_transition':  return 'since_transition';
    case 'since_summarizer':  return `since_summarizer:${mode.summarizerName}`;
  }
}

/** Decode the <select> value back into a HistoryMode. */
function decodeMode(value: string): HistoryMode {
  if (value === 'none')              return { mode: 'none' };
  if (value === 'all')               return { mode: 'all' };
  if (value === 'since_transition')  return { mode: 'since_transition' };
  if (value.startsWith('last_n:')) {
    const n = Math.max(1, Math.floor(Number(value.slice('last_n:'.length)) || 5));
    return { mode: 'last_n', n };
  }
  if (value.startsWith('since_summarizer:')) {
    return { mode: 'since_summarizer', summarizerName: value.slice('since_summarizer:'.length) };
  }
  return { mode: 'none' };
}

/** Walk every addon on the agent (cortex + crew addons) and harvest
 *  declared summarizer names. Free-form names are unique per agent
 *  (validator concern); we just dedupe here so a hand-edit can't
 *  surface duplicates in the dropdown. */
function useSummarizerNames(agentId: ID): string[] {
  const { doc } = useBuilder();
  return useMemo(() => {
    const agent = doc.agents.find(a => a.id === agentId);
    if (!agent) return [];
    const names = new Set<string>();
    const harvest = (addons: AddonInstance[] | undefined) => {
      for (const a of addons ?? []) {
        if (a?.pluginId !== SUMMARIZER_PLUGIN_ID) continue;
        const cfg = a.config as { name?: string } | undefined;
        const n = (cfg?.name || '').trim();
        if (n) names.add(n);
      }
    };
    harvest(agent.cortex);
    for (const c of agent.crews ?? []) harvest(c.addons);
    return Array.from(names).sort();
  }, [doc, agentId]);
}

export function AddonContextSection({ agentId, crewId, instance }: Props) {
  const muts = useAddonMutations(agentId, crewId);
  const ctx = instance.context;
  const patch = (next: Partial<AddonContext>) =>
    muts.updateContext(instance.instanceId, { ...ctx, ...next });

  const summarizerNames = useSummarizerNames(agentId);
  const value = encodeMode(ctx.history);

  return (
    <InlineField label="History" hint="Which past messages this addon sees on each turn.">
      <select
        className={styles.select}
        value={value}
        onChange={e => patch({ history: decodeMode(e.target.value) })}
      >
        <option value="none">None</option>
        <option value="last_n:3">Last 3 messages</option>
        <option value="last_n:5">Last 5 messages</option>
        <option value="last_n:10">Last 10 messages</option>
        <option value="all">Full conversation</option>
        <option value="since_transition">Since last crew transition</option>
        {summarizerNames.length > 0 && (
          <optgroup label="Since summarizer">
            {summarizerNames.map(name => (
              <option key={name} value={`since_summarizer:${name}`}>
                Since "{name}"
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </InlineField>
  );
}
