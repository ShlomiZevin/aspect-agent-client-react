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
import type { TalkerConfig } from '../../types';
import styles from './TalkerConfig.module.css';

export function TalkerConfigComponent({
  config,
  onChange,
  instance,
  agentId,
}: PluginConfigProps<TalkerConfig>) {
  const patch = (next: Partial<TalkerConfig>) => onChange({ ...config, ...next });
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, {
    onCreateSnippet: () => openCreateSnippet(agentId),
  });
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.wrap}>
      <InlineField label="Model" hint="LLM used for this addon's call.">
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
        />
      </InlineField>

      <section className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <label className={styles.sectionLabel} htmlFor="talker-prompt">
            Voice prompt
          </label>
          <ExpandPromptToggle
            text={config.prompt}
            expanded={expanded}
            onToggle={setExpanded}
          />
        </div>
        <p className={styles.sectionHint}>
          What this crew is supposed to say. Type
          {' '}<kbd>@</kbd> memory ·
          {' '}<kbd>!</kbd> thinking ·
          {' '}<kbd>#</kbd> parameters ·
          {' '}<kbd>^</kbd> persona ·
          {' '}<kbd>*</kbd> enum / dc ·
          {' '}<kbd>+</kbd> snippets ·
          {' '}<kbd>/</kbd> or <kbd>{'{{'}</kbd> for all.
        </p>
        {expanded ? (
          <ExpandedPromptView
            agentId={agentId}
            text={config.prompt}
            rows={10}
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        ) : (
          <MentionTextarea
            value={config.prompt}
            onChange={prompt => patch({ prompt })}
            options={mentionOptions}
            placeholder="You are… {{persona}}. Here is what you know: {{memory}}."
            rows={10}
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        )}
        <SnippetsUsedFooter agentId={agentId} text={config.prompt} />
      </section>
    </div>
  );
}
