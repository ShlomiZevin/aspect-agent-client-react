/**
 * Talker — config screen.
 *
 * The Talker is the addon that actually speaks to the user. Its
 * prompt is the crew's voice — what the agent should say, how it
 * should say it, and any rules about phrasing.
 *
 * Phase B: the prompt is one mention-aware textarea. Type `@` to
 * insert a memory field / domain / the whole memory section / the
 * persona; `!` for thinking; `#` for parameters. The picker reads its
 * vocabulary from the agent's actual schema so each agent's tokens
 * reflect its declared fields and parameters.
 */

import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import type { PluginConfigProps } from '../../registry/plugins';
import type { TalkerConfig } from '../../types';
import styles from './TalkerConfig.module.css';

export function TalkerConfigComponent({
  config,
  onChange,
  agentId,
}: PluginConfigProps<TalkerConfig>) {
  const patch = (next: Partial<TalkerConfig>) => onChange({ ...config, ...next });
  const mentionOptions = useMentionOptions(agentId);

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
          What this crew is supposed to say. Type
          {' '}<kbd>@</kbd> memory ·
          {' '}<kbd>!</kbd> thinking ·
          {' '}<kbd>#</kbd> parameters ·
          {' '}<kbd>^</kbd> persona ·
          {' '}<kbd>*</kbd> dynamic ·
          {' '}<kbd>/</kbd> or <kbd>{'{{'}</kbd> for all.
        </p>
        <MentionTextarea
          value={config.prompt}
          onChange={prompt => patch({ prompt })}
          options={mentionOptions}
          placeholder="You are… {{persona}}. Here is what you know: {{memory}}."
          rows={10}
        />
      </section>
    </div>
  );
}
