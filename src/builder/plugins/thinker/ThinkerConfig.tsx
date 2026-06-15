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

import { useState } from 'react';
import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import { InlineField } from '../../components/AddonModal/InlineField';
import { SnippetsUsedFooter } from '../../components/Snippets/SnippetsUsedFooter';
import { useSnippetCreator } from '../../components/Snippets/SnippetCreator';
import { ExpandPromptToggle } from '../../components/Snippets/ExpandPromptToggle';
import { ExpandedPromptView } from '../../components/Snippets/ExpandedPromptView';
import type { PluginConfigProps } from '../../registry/plugins';
import type { ThinkerConfig } from '../../types';
import styles from './ThinkerConfig.module.css';

export function ThinkerConfigComponent({
  config,
  onChange,
  instance,
  agentId,
}: PluginConfigProps<ThinkerConfig>) {
  const patch = (next: Partial<ThinkerConfig>) => onChange({ ...config, ...next });
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, {
    onCreateSnippet: () => openCreateSnippet(agentId),
  });
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.wrap}>
      <InlineField label="Name" hint="Shown on the chain card. Leave empty to use the plugin name.">
        <input
          className={styles.input}
          type="text"
          value={config.name ?? ''}
          onChange={e => patch({ name: e.target.value })}
          placeholder="e.g. Strategist (optional)"
        />
      </InlineField>

      <InlineField
        label="Domain"
        hint={`The brain section this Thinker writes into. Read its output downstream with {{thinking:${config.domain || 'strategy'}}} or {{thinking}} for every domain at once.`}
      >
        <input
          className={styles.input}
          type="text"
          value={config.domain ?? 'strategy'}
          onChange={e => patch({ domain: e.target.value })}
          placeholder="strategy"
        />
      </InlineField>

      <InlineField label="Model" hint="LLM used for this addon's call.">
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
        />
      </InlineField>

      <div className={styles.field}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className={styles.label}>Strategic prompt</span>
          <ExpandPromptToggle
            text={config.prompt}
            expanded={expanded}
            onToggle={setExpanded}
          />
        </div>
        {expanded ? (
          <ExpandedPromptView
            agentId={agentId}
            text={config.prompt}
            rows={14}
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        ) : (
          <MentionTextarea
            value={config.prompt}
            onChange={prompt => patch({ prompt })}
            options={mentionOptions}
            rows={14}
            placeholder="Tell the LLM what strategy to produce and which JSON keys to emit. Type @ memory · # parameters · ^ persona · * enum/dc · + snippets · / or {{ for all."
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        )}
        <SnippetsUsedFooter agentId={agentId} text={config.prompt} />
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
