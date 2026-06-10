/**
 * Summarizer — config screen.
 *
 *   1. Name — token name used in `{{summary:NAME}}` AND in
 *      `since_summarizer: NAME` history references. Free-form.
 *   2. Model — the LLM that produces the synthesis.
 *   3. Prompt — the synthesis instructions. Mention-aware.
 *
 * The trigger (every_n_messages / on_transition) is configured in the
 * standard AddonContextSection — same place every other offline addon
 * configures its "When". History (what slice this summarizer reads)
 * also lives in AddonContextSection. Keeping plugin-specific config
 * to the minimum means new offline-addon types don't have to learn
 * new patterns — they just declare their config + reuse the shared
 * sections.
 */

import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import { InlineField } from '../../components/AddonModal/InlineField';
import type { PluginConfigProps } from '../../registry/plugins';
import type { SummarizerConfig } from '../../types';
import styles from './SummarizerConfig.module.css';

export function SummarizerConfigComponent({
  config,
  onChange,
  instance,
  agentId,
}: PluginConfigProps<SummarizerConfig>) {
  const patch = (next: Partial<SummarizerConfig>) => onChange({ ...config, ...next });
  const mentionOptions = useMentionOptions(agentId);

  return (
    <div className={styles.wrap}>
      <InlineField
        label="Name"
        hint='The token name used in {{summary:NAME}} and in the "since this summarizer" history mode. Unique per agent.'
      >
        <input
          className={styles.input}
          type="text"
          value={config.name ?? ''}
          onChange={e => patch({ name: e.target.value })}
          placeholder="main"
          spellCheck={false}
        />
      </InlineField>

      <InlineField label="Model" hint="LLM that produces the synthesis. Cheap models work well — the prompt is the strategy.">
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
        />
      </InlineField>

      <section className={styles.promptSection}>
        <label className={styles.promptLabel}>Synthesis prompt</label>
        <p className={styles.promptHint}>
          Tell the LLM how to distil the conversation. Reference
          memory with <code>@</code>, parameters with <code>#</code>,
          persona with <code>^</code>. The LLM should return
          <code>{' { "text": "<synthesis>" } '}</code> — the engine
          writes <code>text</code> to <code>brain.summary[{config.name || 'main'}]</code>
          and records the message-id watermark for the
          <code>{' since_summarizer '}</code> mode.
        </p>
        <MentionTextarea
          value={config.prompt}
          onChange={prompt => patch({ prompt })}
          options={mentionOptions}
          placeholder="Summarise the conversation so far in 6–12 lines. Output JSON: { text: '...' }. Type @ memory · # parameters · ^ persona · / for all."
          rows={14}
          storageKey={`addon:${instance.instanceId}:prompt`}
        />
      </section>
    </div>
  );
}
