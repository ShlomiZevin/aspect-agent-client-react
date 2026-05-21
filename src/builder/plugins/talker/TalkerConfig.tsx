/**
 * Talker — config screen.
 *
 * The Talker is the addon that actually speaks to the user. Its
 * prompt is the crew's voice — what the agent should say, how it
 * should say it, and any rules about phrasing.
 *
 * Two fields for now: model and prompt. Later we'll add things like
 * history-length, which context domains it reads, structured output,
 * etc.
 */

import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import type { PluginConfigProps } from '../../registry/plugins';
import type { TalkerConfig } from '../../types';
import styles from './TalkerConfig.module.css';

export function TalkerConfigComponent({
  config,
  onChange,
}: PluginConfigProps<TalkerConfig>) {
  const patch = (next: Partial<TalkerConfig>) => onChange({ ...config, ...next });

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
          label="Model"
        />
      </section>

      <section className={styles.section}>
        <label className={styles.sectionLabel} htmlFor="talker-prompt">
          Voice prompt
        </label>
        <p className={styles.sectionHint}>
          What this crew is supposed to say, in this phase, with this user.
          Plain language. The agent persona is layered automatically.
        </p>
        <textarea
          id="talker-prompt"
          className={styles.textarea}
          value={config.prompt}
          onChange={e => patch({ prompt: e.target.value })}
          placeholder="In this phase you are…"
        />
      </section>
    </div>
  );
}
