/**
 * AddonOutputSection — configurable output type + the writes
 * destination derived from the plugin's config.
 *
 * Two controls:
 *   - Output type → dropdown from the plugin's `allowedOutputTypes`.
 *     Disabled when the plugin only allows one type (still visible
 *     so the concept is explicit).
 *   - Writes (for `json-to-memory` types) → list of memory domains
 *     and the fields that land in each. Derived from `config.fields`
 *     for extractor plugins; informational, not editable here.
 */

import { useState } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { getPlugin } from '../../registry/plugins';
import type { AddonInstance, ID, OutputType } from '../../types';
import styles from './AddonOutputSection.module.css';

interface Props {
  agentId: ID;
  crewId: ID;
  instance: AddonInstance;
}

const OUTPUT_TYPE_LABEL: Record<OutputType, string> = {
  'text-to-user':    '💬 Text — spoken to the user',
  'json-to-memory':  '{ } JSON — written to memory',
};

export function AddonOutputSection({ agentId, crewId, instance }: Props) {
  const { setAddonOutputType } = useBuilder();
  const [open, setOpen] = useState(false);

  const plugin = getPlugin(instance.pluginId);
  const allowed: OutputType[] =
    plugin?.allowedOutputTypes && plugin.allowedOutputTypes.length > 0
      ? plugin.allowedOutputTypes
      : ['text-to-user', 'json-to-memory'];

  const summary = OUTPUT_TYPE_LABEL[instance.outputType] ?? instance.outputType;

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen(o => !o)}
      >
        <span className={styles.caret}>{open ? '▾' : '▸'}</span>
        <span className={styles.title}>Output</span>
        <span className={styles.summary}>{summary}</span>
      </button>

      {open && (
        <div className={styles.body}>
          <div className={styles.row}>
            <label className={styles.knobLabel}>Type</label>
            <select
              className={styles.select}
              value={instance.outputType}
              onChange={e =>
                setAddonOutputType(agentId, crewId, instance.instanceId, e.target.value as OutputType)
              }
              disabled={allowed.length <= 1}
              title={
                allowed.length <= 1
                  ? 'Locked by this plugin — no other output types allowed.'
                  : undefined
              }
            >
              {allowed.map(t => (
                <option key={t} value={t}>
                  {OUTPUT_TYPE_LABEL[t] ?? t}
                </option>
              ))}
            </select>
          </div>

        </div>
      )}
    </section>
  );
}
