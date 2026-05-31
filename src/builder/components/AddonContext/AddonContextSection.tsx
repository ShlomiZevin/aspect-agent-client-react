/**
 * AddonContextSection — the universal "Context" block in every
 * addon's config modal.
 *
 * Phase B: the persona / memory / thinking toggles are gone. Placement
 * of those blocks lives inside the addon's promptTemplate (via the
 * MentionTextarea), not as structured knobs. What remains here:
 *
 *   1. History — none / last N / full. History is conversation data
 *      passed to the LLM as a separate parameter, not template text,
 *      so it can't be folded into the template.
 *   2. Triggered reads — only when at least one Triggered Context
 *      loader exists in this crew. Triggered context still uses the
 *      structured reads list until the Triggered Context redesign.
 */

import { useMemo, useState } from 'react';
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
  const [open, setOpen] = useState(false);

  // Triggered domains available in this crew — sourced from every
  // Triggered Context loader's `config.domain`.
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
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.caret}>{open ? '▾' : '▸'}</span>
        <span className={styles.title}>Context</span>
        <span className={styles.summary}>{summarise(ctx)}</span>
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.row}>
            <label className={styles.knobLabel}>History</label>
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
            <div className={styles.memoryBlock}>
              <label className={styles.knobLabel}>Triggered</label>
              <div className={styles.memoryList}>
                {triggeredDomainList.map(d => (
                  <label key={d} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={triggeredSelected.has(d)}
                      onChange={() => toggleTriggeredDomain(d)}
                    />
                    <span className={styles.domainName}>🎯 {d}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function summarise(ctx: AddonContext): string {
  const parts: string[] = [];
  if (ctx.history.mode === 'none') parts.push('no history');
  else if (ctx.history.mode === 'full') parts.push('full history');
  else parts.push(`last ${ctx.history.n ?? 5} msgs`);
  const triggered = (ctx.triggeredReads ?? []).length;
  if (triggered > 0) parts.push(`triggered: ${triggered}`);
  return parts.join(' · ');
}
