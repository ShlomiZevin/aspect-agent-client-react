/**
 * AddonContextSection — runtime conversation settings for the addon.
 *
 * After Dynamic Context replaced Triggered Context, the only universal
 * runtime knob left is `history` — how much past conversation gets
 * sent to the LLM. The component renders as a single inline row with
 * no accordion. Component name still ends in `Context` because the
 * data lives on `AddonInstance.context`; the user-facing label is
 * "History".
 */

import { useAddonMutations } from '../../state/useAddonMutations';
import { InlineField } from '../AddonModal/InlineField';
import type { AddonContext, AddonInstance, HistoryMode, ID } from '../../types';
import styles from './AddonContextSection.module.css';

interface Props {
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
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
  const muts = useAddonMutations(agentId, crewId);
  const ctx = instance.context;
  const patch = (next: Partial<AddonContext>) =>
    muts.updateContext(instance.instanceId, { ...ctx, ...next });

  const historyChoice = choiceFromMode(ctx.history);

  return (
    <InlineField label="History" hint="How many past messages this addon sees on each turn.">
      <select
        className={styles.select}
        value={historyChoice}
        onChange={e => patch({ history: modeFromChoice(e.target.value as HistoryChoice) })}
      >
        {HISTORY_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </InlineField>
  );
}
