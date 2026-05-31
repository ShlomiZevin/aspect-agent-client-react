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
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import type { PluginConfigProps } from '../../registry/plugins';
import type { ThinkerConfig } from '../../types';
import styles from './ThinkerConfig.module.css';

export function ThinkerConfigComponent({
  config,
  onChange,
  agentId,
}: PluginConfigProps<ThinkerConfig>) {
  const patch = (next: Partial<ThinkerConfig>) => onChange({ ...config, ...next });
  const mentionOptions = useMentionOptions(agentId);

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
          The brain section this Thinker writes into. Read its output
          downstream with <code>{`{{thinking:${config.domain || 'strategy'}}}`}</code>
          (or <code>{'{{thinking}}'}</code> for every domain at once).
        </span>
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Model</span>
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Strategic prompt</span>
        <MentionTextarea
          value={config.prompt}
          onChange={prompt => patch({ prompt })}
          options={mentionOptions}
          rows={14}
          placeholder="Tell the LLM what strategy to produce and which JSON keys to emit. Type @ memory · # parameters · ^ persona · {{ for all."
        />
        <span className={styles.hint}>
          The prompt is the schema. Whatever keys the LLM emits land
          under the configured thinking domain; downstream addons read
          them via <code>{'{{thinking}}'}</code> or
          <code>{`{{thinking:${config.domain || 'strategy'}}}`}</code>.
        </span>
      </div>
    </div>
  );
}
