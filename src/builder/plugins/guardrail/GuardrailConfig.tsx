/**
 * Guardrail — config screen (task #963). Existing Builder pieces only:
 * the Thinker's field layout, the model picker, the mention prompt editor,
 * the Web-search switch for toggles, plain selects.
 *
 *   1. Name, model
 *   2. Hold the answer (off = flag only, after the fact)
 *   3. With hold on: what it may do (replace / block), the block message,
 *      the crew a block moves to, what happens if it fails
 *   4. The prompt — {{reply}} is the reply it checks
 *
 * The hold-only settings stay where they are and are disabled in place
 * while hold is off, so switching never moves anything.
 */

import { useState } from 'react';
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
import type { GuardrailConfig } from '../../types';
import styles from '../thinker/ThinkerConfig.module.css';
import ws from '../../components/WebSearch/WebSearchSetting.module.css';

const BUILT_IN_BLOCK = 'מצטערים, לא נוכל לענות על זה כאן. נציג מטעמנו ימשיך איתך.';

export function GuardrailConfigComponent({
  config,
  onChange,
  instance,
  agentId,
  crewId,
}: PluginConfigProps<GuardrailConfig>) {
  const patch = (next: Partial<GuardrailConfig>) => onChange({ ...config, ...next });
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, { onCreateSnippet: () => openCreateSnippet(agentId) });
  const { doc } = useBuilder();
  const crews = doc.agents.find(a => a.id === agentId)?.crews ?? [];
  const otherCrews = crews.filter(c => c.id !== crewId);
  const [expanded, setExpanded] = useState(false);

  const offline = instance.lane === 'offline';
  const hold = config.holdReply === true && !offline;
  const canReplace = config.actions?.replace !== false;
  const canBlock = config.actions?.block !== false;
  const setAction = (key: 'replace' | 'block', on: boolean) =>
    patch({ actions: { replace: canReplace, block: canBlock, [key]: on } });
  const holdOnly = { opacity: hold ? 1 : 0.5 } as const;
  const blockOnly = { opacity: hold && canBlock ? 1 : 0.5 } as const;

  return (
    <div className={styles.wrap}>
      <InlineField label="Name" hint="Shown on the chain card. Leave empty to use the plugin name.">
        <input
          className={styles.input}
          type="text"
          value={config.name ?? ''}
          onChange={e => patch({ name: e.target.value })}
          placeholder="e.g. Compliance check (optional)"
        />
      </InlineField>

      <InlineField label="Model" hint="With hold on the customer waits for this call — pick a fast model that doesn't think first (GPT-5.6 Terra, GPT-4o, Claude 4.x).">
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
          outputLimit={config.maxOutputTokens}
          onOutputLimitChange={maxOutputTokens => patch({ maxOutputTokens })}
        />
      </InlineField>

      <InlineField
        label="Hold the answer"
        hint={offline
          ? 'Offline lane: always flag only — an audit after the reply, no wait.'
          : 'On: the Talker before it runs held — nothing streams until this Guardrail decided, then approve / replace / block apply. Off: the reply streams as usual and the verdict is only recorded as a flag.'}
      >
        <div className={ws.row}>
          <Toggle on={hold} disabled={offline} onChange={v => patch({ holdReply: v })} label="Hold the answer" />
          <span className={`${ws.summary} ${hold ? '' : ws.summaryOff}`}>
            {hold ? 'On — the reply waits for the verdict' : 'Off — flag only, after the fact'}
          </span>
        </div>
      </InlineField>

      <InlineField label="It may" hint={hold ? 'What a verdict may do with the reply.' : 'Only with hold on.'}>
        <div style={holdOnly}>
          <div className={ws.row}>
            <Toggle on={canReplace} disabled={!hold} onChange={v => setAction('replace', v)} label="Replace the reply" />
            <span className={`${ws.summary} ${hold && canReplace ? '' : ws.summaryOff}`}>Replace the reply with a corrected one</span>
          </div>
          <div className={ws.row}>
            <Toggle on={canBlock} disabled={!hold} onChange={v => setAction('block', v)} label="Block the reply" />
            <span className={`${ws.summary} ${hold && canBlock ? '' : ws.summaryOff}`}>Block it — send the block message instead</span>
          </div>
        </div>
      </InlineField>

      <InlineField label="Block message" hint="What the customer gets instead of a blocked reply (and when the Guardrail fails closed). Empty = the built-in sentence.">
        <textarea
          className={styles.input}
          style={{ ...blockOnly, minHeight: 64, resize: 'vertical' }}
          rows={3}
          dir="auto"
          disabled={!hold || !canBlock}
          value={config.blockMessage ?? ''}
          placeholder={BUILT_IN_BLOCK}
          onChange={e => patch({ blockMessage: e.target.value })}
        />
      </InlineField>

      <InlineField label="After a block" hint="The crew the conversation moves to from the next turn (e.g. a human-handoff crew).">
        <select
          className={ws.select}
          style={blockOnly}
          disabled={!hold || !canBlock}
          value={config.escalateTo ?? ''}
          onChange={e => patch({ escalateTo: e.target.value || null })}
        >
          <option value="">Stay in this crew</option>
          {otherCrews.map(c => <option key={c.id} value={c.id}>Move to “{c.name}”</option>)}
          {/* One crew only: show the option exists, so it doesn't look missing. */}
          {otherCrews.length === 0 && <option value="" disabled>No other crew yet — add one to move there</option>}
        </select>
      </InlineField>

      <InlineField label="If it fails" hint="No valid verdict (model error, cut off, bad JSON).">
        <select
          className={ws.select}
          style={holdOnly}
          disabled={!hold}
          value={config.onError === 'approve' ? 'approve' : 'block'}
          onChange={e => patch({ onError: e.target.value === 'approve' ? 'approve' : 'block' })}
        >
          <option value="block">Block — fail closed (the block message goes out)</option>
          <option value="approve">Let the reply through</option>
        </select>
      </InlineField>

      <div className={styles.field}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className={styles.label}>Prompt — your rules</span>
          <PromptPreviewToggle expanded={expanded} onToggle={setExpanded} />
        </div>
        {expanded ? (
          <PromptPreviewView instance={instance} config={config} agentId={agentId} crewId={crewId}
            rows={14} storageKey={`addon:${instance.instanceId}:prompt`} />
        ) : (
          <MentionTextarea
            value={config.prompt}
            onChange={prompt => patch({ prompt })}
            options={mentionOptions}
            rows={14}
            placeholder="The rules the reply must keep. {{reply}} is the reply it checks. Type @ memory · # parameters · ^ persona · / or {{ for all."
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        )}
        <SnippetsUsedFooter agentId={agentId} text={config.prompt} />
        <span className={styles.hint}>
          <code>{'{{reply}}'}</code> is this turn&apos;s reply so far (empty before the Talker). The runtime adds a short
          &ldquo;Your verdict&rdquo; section at the end (see the run card) telling the model which JSON to return.
        </span>
      </div>
    </div>
  );
}

/** The Web-search switch (same markup + styles). */
function Toggle({ on, onChange, label, disabled = false }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className={`${ws.toggle} ${on ? ws.toggleOn : ''} ${disabled ? ws.toggleDisabled : ''}`}>
      <input
        type="checkbox"
        className={ws.toggleInput}
        checked={on}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className={ws.toggleKnob} />
    </span>
  );
}
