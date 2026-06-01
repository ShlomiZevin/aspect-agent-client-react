/**
 * AddonContextSection — runtime conversation settings for the addon.
 *
 * Phase B / v3 layout: flat inline rows. The whole "collapsible Context
 * box" wrapper is gone — when a section holds a single dropdown it
 * doesn't deserve its own accordion. Today this surface carries:
 *
 *   - History    — how much past conversation to send. Always shown.
 *   - Triggered  — which triggered-context domains to inject. Only
 *                  rendered when a Triggered Context loader exists in
 *                  the crew (otherwise the row is noise).
 *
 * The component name still ends in `Context` because the data lives
 * on `AddonInstance.context`; the user-facing labels are History +
 * Triggered.
 */

import { useMemo } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { TRIGGERED_CONTEXT_PLUGIN_ID } from '../../plugins/triggeredContext/addon.triggeredContext';
import type { AddonContext, AddonInstance, HistoryMode, ID, TriggeredContextConfig } from '../../types';
import styles from './AddonContextSection.module.css';

interface Props {
  agentId: ID;
  crewId: ID;
  instance: AddonInstance;
}

type HistoryChoice = 'none' | 'last_3' | 'last_5' | 'last_10' | 'full';

function choiceFromMode(mode: HistoryMode): HistoryChoice {
  if (mode.mode === 'none') return 'none';
  if (mode.mode === 'full') return 'full';
  switch (mode.n) {
    case 3:  return 'last_3';
    case 10: return 'last_10';
    default: return 'last_5';
  }
}

function modeFromChoice(choice: HistoryChoice): HistoryMode {
  switch (choice) {
    case 'none':    return { mode: 'none' };
    case 'last_3':  return { mode: 'last_n', n: 3 };
    case 'last_5':  return { mode: 'last_n', n: 5 };
    case 'last_10': return { mode: 'last_n', n: 10 };
    case 'full':    return { mode: 'full' };
  }
}

const HISTORY_OPTIONS: { value: HistoryChoice; label: string }[] = [
  { value: 'none',    label: 'None' },
  { value: 'last_3',  label: 'Last 3 messages' },
  { value: 'last_5',  label: 'Last 5 messages' },
  { value: 'last_10', label: 'Last 10 messages' },
  { value: 'full',    label: 'Full conversation' },
];

export function AddonContextSection({ agentId, crewId, instance }: Props) {
  const { doc, updateAddonContext } = useBuilder();

  // Triggered domains exposed by Triggered Context loaders in this crew.
  // No loaders → the Triggered row isn't shown at all (it'd be empty).
  const triggeredDomains = useMemo<string[]>(() => {
    const set = new Set<string>();
    const crew = doc.agents.find(a => a.id === agentId)?.crews.find(c => c.id === crewId);
    for (const a of crew?.addons ?? []) {
      if (a.pluginId !== TRIGGERED_CONTEXT_PLUGIN_ID) continue;
      const dom = (a.config as TriggeredContextConfig | undefined)?.domain?.trim();
      if (dom) set.add(dom);
    }
    return [...set].sort();
  }, [doc, agentId, crewId]);

  const ctx = instance.context;
  const patch = (next: Partial<AddonContext>) =>
    updateAddonContext(agentId, crewId, instance.instanceId, { ...ctx, ...next });

  const triggeredReads = ctx.triggeredReads ?? [];
  const triggeredSelected = useMemo(() => new Set<string>(
    triggeredReads.filter((v): v is string => typeof v === 'string'),
  ), [triggeredReads]);
  const triggeredDomainList = useMemo<string[]>(() => {
    const set = new Set<string>(triggeredDomains);
    for (const v of triggeredReads) if (typeof v === 'string') set.add(v);
    return [...set].sort();
  }, [triggeredDomains, triggeredReads]);

  const toggleTriggeredDomain = (d: string) => {
    const next = new Set(triggeredSelected);
    if (next.has(d)) next.delete(d); else next.add(d);
    patch({ triggeredReads: [...next] });
  };

  const historyChoice = choiceFromMode(ctx.history);

  return (
    <div className={styles.runtimeRows}>
      <div className={styles.row}>
        <span className={styles.label}>History</span>
        <select
          className={styles.select}
          value={historyChoice}
          onChange={e => patch({ history: modeFromChoice(e.target.value as HistoryChoice) })}
        >
          {HISTORY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {triggeredDomainList.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>Triggered</span>
          <div className={styles.chips}>
            {triggeredDomainList.map(d => (
              <label key={d} className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={triggeredSelected.has(d)}
                  onChange={() => toggleTriggeredDomain(d)}
                />
                <span>🎯 {d}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
