/**
 * AddonOutputSection — what this addon produces at runtime.
 *
 * v3 layout: flat inline row. When the plugin allows multiple output
 * types the row carries a dropdown; when it's locked to one (the
 * common case — Talker only speaks, extractors only write memory),
 * the row degrades to a small static badge so it doesn't pretend to
 * be interactive. Either way it sits at the same vertical rhythm as
 * the History row next to it.
 */

import { useAddonMutations } from '../../state/useAddonMutations';
import { getPlugin } from '../../registry/plugins';
import type { AddonInstance, ID, OutputType } from '../../types';
import styles from './AddonOutputSection.module.css';

interface Props {
  agentId: ID;
  /** null → agent-cortex scope. */
  crewId: ID | null;
  instance: AddonInstance;
}

const OUTPUT_TYPE_LABEL: Record<OutputType, string> = {
  'text-to-user':    '💬 Text — spoken to the user',
  'json-to-memory':  '{ } JSON — written to memory',
  'transition':      '⇥ Transition — handoff to next crew',
};

export function AddonOutputSection({ agentId, crewId, instance }: Props) {
  const muts = useAddonMutations(agentId, crewId);

  const plugin = getPlugin(instance.pluginId);
  const allowed: OutputType[] =
    plugin?.allowedOutputTypes && plugin.allowedOutputTypes.length > 0
      ? plugin.allowedOutputTypes
      : ['text-to-user', 'json-to-memory'];

  const currentLabel = OUTPUT_TYPE_LABEL[instance.outputType] ?? instance.outputType;
  const locked = allowed.length <= 1;

  return (
    <div className={styles.row}>
      <span className={styles.label}>Output</span>
      {locked ? (
        <span className={styles.staticBadge} title="Locked by this plugin — no other output types allowed.">
          {currentLabel}
        </span>
      ) : (
        <select
          className={styles.select}
          value={instance.outputType}
          onChange={e =>
            muts.setOutputType(instance.instanceId, e.target.value as OutputType)
          }
        >
          {allowed.map(t => (
            <option key={t} value={t}>{OUTPUT_TYPE_LABEL[t] ?? t}</option>
          ))}
        </select>
      )}
    </div>
  );
}
