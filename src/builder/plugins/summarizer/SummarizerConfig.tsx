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

import { useEffect, useRef, useState } from 'react';
import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import { InlineField } from '../../components/AddonModal/InlineField';
import { SnippetsUsedFooter } from '../../components/Snippets/SnippetsUsedFooter';
import { useSnippetCreator } from '../../components/Snippets/SnippetCreator';
import { PromptPreviewToggle } from '../../components/PromptPreview/PromptPreviewToggle';
import { PromptPreviewView } from '../../components/PromptPreview/PromptPreviewView';
import { useBuilder } from '../../state/BuilderContext';
import type { PluginConfigProps } from '../../registry/plugins';
import type { SummarizerConfig } from '../../types';
import styles from './SummarizerConfig.module.css';

export function SummarizerConfigComponent({
  config,
  onChange,
  instance,
  agentId,
  crewId,
}: PluginConfigProps<SummarizerConfig>) {
  const patch = (next: Partial<SummarizerConfig>) => onChange({ ...config, ...next });
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, {
    onCreateSnippet: () => openCreateSnippet(agentId),
  });
  const [expanded, setExpanded] = useState(false);

  // Token-rename cascade for the summarizer's name. The input fires
  // `patch({ name })` on every keystroke (so intermediate state can
  // be inspected by the rest of the UI), but we only cascade
  // `{{summary:OLD}}` → `{{summary:NEW}}` once the user commits a
  // stable name — on blur OR when the component unmounts. Cascading
  // per-keystroke would either rewrite tokens through every
  // intermediate value (correct but noisy) or be skipped during
  // empty-intermediate windows (broken). Blur-commit avoids both.
  const { applyTokenRenameCascade } = useBuilder();
  const lastCommittedNameRef = useRef<string>(config.name ?? '');

  const commitNameRename = () => {
    const prev = lastCommittedNameRef.current;
    const curr = (config.name ?? '').trim();
    if (!prev || !curr || prev === curr) {
      lastCommittedNameRef.current = curr;
      return;
    }
    applyTokenRenameCascade(agentId, 'summarizer', prev, curr);
    lastCommittedNameRef.current = curr;
  };

  // Catch the case where the user closes the addon modal without
  // blurring (escape, click-outside) — cascade on unmount so the
  // last committed name still gets its tokens rewritten.
  useEffect(() => {
    return () => { commitNameRename(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          onBlur={commitNameRename}
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <label className={styles.promptLabel}>Synthesis prompt</label>
          <PromptPreviewToggle expanded={expanded} onToggle={setExpanded} />
        </div>
        <p className={styles.promptHint}>
          Tell the LLM how to distil the conversation. Reference
          memory with <code>@</code>, parameters with <code>#</code>,
          persona with <code>^</code>. The LLM should return
          <code>{' { "text": "<synthesis>" } '}</code> — the engine
          writes <code>text</code> to <code>brain.summary[{config.name || 'main'}]</code>
          and records the message-id watermark for the
          <code>{' since_summarizer '}</code> mode.
        </p>
        {expanded ? (
          <PromptPreviewView instance={instance} config={config} agentId={agentId} crewId={crewId}
            rows={14} storageKey={`addon:${instance.instanceId}:prompt`} />
        ) : (
          <MentionTextarea
            value={config.prompt}
            onChange={prompt => patch({ prompt })}
            options={mentionOptions}
            placeholder="Summarise the conversation so far in 6–12 lines. Output JSON: { text: '...' }. Type @ memory · # parameters · ^ persona · + snippets · / for all."
            rows={14}
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        )}
        <SnippetsUsedFooter agentId={agentId} text={config.prompt} />
      </section>
    </div>
  );
}
