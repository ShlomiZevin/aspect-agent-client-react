/**
 * Thinker — config screen.
 *
 *   1. Name (user-editable label, e.g. "Strategist" / "Tone Planner")
 *   2. Model + the strategic prompt
 *   3. Domain — where in the brain's `thinking` section this Thinker
 *      writes (e.g. `strategy`, `tone`). Defaults to 'strategy'.
 *
 * No "Extracted by"/fields section — Thinker has no declared field
 * schema. The prompt is the contract; the LLM emits whatever keys it
 * was told to and the server writes them all under the configured
 * domain. See the addon's `purpose` for the design rationale.
 */

import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import type { PluginConfigProps } from '../../registry/plugins';
import type { ThinkerConfig } from '../../types';
import styles from './ThinkerConfig.module.css';

export function ThinkerConfigComponent({
  config,
  onChange,
}: PluginConfigProps<ThinkerConfig>) {
  const patch = (next: Partial<ThinkerConfig>) => onChange({ ...config, ...next });

  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        <span className={styles.label}>Name</span>
        <input
          className={styles.input}
          type="text"
          value={config.name ?? ''}
          onChange={e => patch({ name: e.target.value })}
          placeholder="e.g. Strategist (optional)"
        />
        <span className={styles.hint}>
          Shown on the chain card. Leave empty to use the plugin name.
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Writes to thinking · domain</span>
        <input
          className={styles.input}
          type="text"
          value={config.domain ?? 'strategy'}
          onChange={e => patch({ domain: e.target.value })}
          placeholder="strategy"
        />
        <span className={styles.hint}>
          The brain section this Thinker writes into. The Talker reads
          via <code>thinkingReads</code> — tick this same domain on
          the Talker so its prompt sees the guidance.
        </span>
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Model</span>
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
        />
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Strategic prompt</span>
        <textarea
          className={styles.textarea}
          value={config.prompt}
          onChange={e => patch({ prompt: e.target.value })}
          rows={14}
          placeholder="Tell the LLM what strategy to produce and which JSON keys to emit."
        />
        <span className={styles.hint}>
          The prompt is the schema. Whatever keys you ask the LLM to
          emit get written to the configured thinking domain, where
          the Talker reads them.
        </span>
      </label>
    </div>
  );
}
