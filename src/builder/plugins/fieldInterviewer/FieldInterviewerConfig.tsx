/**
 * Field Interviewer — config screen.
 *
 * Layout mirrors Field Reasoner (Name / Model / Output field / Prompt)
 * plus a Domain row borrowed from Thinker. The prompt is the heart of
 * the addon — everything else gets a compact row.
 *
 * Why the same WireOrCreateFieldModal as Field Reasoner: Field
 * Interviewer is also single-field-bound. The wire/create UX is
 * identical — only the badge label differs.
 */

import { useMemo, useState } from 'react';
import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import { InlineField } from '../../components/AddonModal/InlineField';
import { FieldEditorModal } from '../../components/FieldsPanel/FieldEditorModal';
import { SnippetsUsedFooter } from '../../components/Snippets/SnippetsUsedFooter';
import { useSnippetCreator } from '../../components/Snippets/SnippetCreator';
import { PromptPreviewToggle } from '../../components/PromptPreview/PromptPreviewToggle';
import { PromptPreviewView } from '../../components/PromptPreview/PromptPreviewView';
import { useCrewFields } from '../../state/useCrewFields';
import { useSlotRenameCascade } from '../../state/useSlotRenameCascade';
import { WireOrCreateFieldModal } from '../fieldReasoner/WireOrCreateFieldModal';
import type { PluginConfigProps } from '../../registry/plugins';
import type { FieldInterviewerConfig, ID } from '../../types';
import styles from '../fieldReasoner/FieldReasonerConfig.module.css';

export function FieldInterviewerConfigComponent({
  config,
  onChange,
  instance,
  agentId,
  crewId,
}: PluginConfigProps<FieldInterviewerConfig>) {
  const patch = (next: Partial<FieldInterviewerConfig>) => onChange({ ...config, ...next });
  const linkedIds: ID[] = config.extractsFields ?? [];
  const firstLinkedId: ID | undefined = linkedIds[0];
  // {{this_field}} / {{enum_values}} resolve to the FIRST bound field
  // — pass it as the boundField hint so the picker descriptions track
  // the field whose values the tokens will surface.
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, {
    boundField: { fieldId: firstLinkedId },
    onCreateSnippet: () => openCreateSnippet(agentId),
  });
  const { allFields, setFieldExtractors } = useCrewFields(agentId, crewId);
  const domainRename = useSlotRenameCascade(agentId, 'thinkingDomain');
  const linkedFields = useMemo(
    () => linkedIds
      .map(id => allFields.find(cf => cf.field.id === id) ?? null)
      .filter((x): x is NonNullable<typeof x> => x !== null),
    [allFields, linkedIds],
  );

  const [wireOpen, setWireOpen] = useState(false);
  const [editFieldId, setEditFieldId] = useState<ID | null>(null);
  const [expanded, setExpanded] = useState(false);
  const editingField = useMemo(
    () => editFieldId ? allFields.find(cf => cf.field.id === editFieldId) ?? null : null,
    [allFields, editFieldId],
  );

  const handleWired = (fieldId: ID) => {
    if (linkedIds.includes(fieldId)) return;
    patch({ extractsFields: [...linkedIds, fieldId] });
  };

  const handleUnlink = (fieldId: ID) => {
    patch({ extractsFields: linkedIds.filter(id => id !== fieldId) });
    const cf = allFields.find(x => x.field.id === fieldId);
    if (cf) {
      const others = cf.extractors
        .map(e => e.instanceId)
        .filter(iid => iid !== instance.instanceId);
      setFieldExtractors(fieldId, others);
    }
  };

  return (
    <div className={styles.wrap}>
      <InlineField
        label="Name"
        hint="Shown on the chain card. Leave blank for the default (Field Interviewer #N)."
      >
        <input
          className={styles.input}
          value={config.name ?? ''}
          onChange={e => patch({ name: e.target.value })}
          placeholder="e.g. Symptom Area Interviewer"
          spellCheck={false}
        />
      </InlineField>

      <InlineField label="Model" hint="LLM used for this addon's call. Stronger models reason more carefully.">
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
        />
      </InlineField>

      <InlineField
        label="Output fields"
        hint={
          linkedFields.length > 1
            ? `Multi-field Interviewer — outputs JSON with one key per field plus non-field keys → thinking. {{this_field}} / {{enum_values}} resolve to "${linkedFields[0].field.name}" (the first field).`
            : 'Field(s) this Interviewer drives toward. Wire one for a focused interviewer, or several to drive related fields in one call.'
        }
      >
        <div className={styles.linkedRow} style={{ flexWrap: 'wrap' }}>
          {linkedFields.map(lf => (
            <span key={lf.field.id} className={styles.linkedRow} style={{ gap: 4 }}>
              <button
                type="button"
                className={styles.linkedChip}
                onClick={() => setEditFieldId(lf.field.id)}
                title={`Edit the declaration of ${lf.field.name}`}
              >
                <span className={styles.linkedIcon}>🎤</span>
                <span className={styles.linkedName}>{lf.field.name}</span>
                <span className={styles.linkedType}>{lf.field.type}</span>
                {lf.scope === 'crew' && <span className={styles.linkedScope}>crew</span>}
              </button>
              <button
                type="button"
                className={styles.unlinkBtn}
                onClick={() => handleUnlink(lf.field.id)}
                title={`Unlink ${lf.field.name}`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className={styles.wireBtn}
            onClick={() => setWireOpen(true)}
          >
            {linkedFields.length === 0 ? '+ Wire or create field' : '+ Add field'}
          </button>
        </div>
      </InlineField>

      <InlineField
        label="Thinking domain"
        hint={`Where non-field keys land in the brain. Read downstream with {{thinking:${config.domain || 'interview'}}}.`}
      >
        <input
          className={styles.input}
          value={config.domain ?? 'interview'}
          onChange={e => patch({ domain: e.target.value })}
          {...domainRename}
          placeholder="interview"
          spellCheck={false}
        />
      </InlineField>

      <section className={styles.promptSection}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <label className={styles.promptLabel} htmlFor="fi-prompt">
            Interview prompt
          </label>
          <PromptPreviewToggle expanded={expanded} onToggle={setExpanded} />
        </div>
        <p className={styles.promptHint}>
          Tell the LLM how to decide what to ask next AND when to commit a value.
          {linkedFields.length <= 1 ? (
            <>
              {' '}Use <code>{'{{this_field}}'}</code> for the output field's name and
              <code> {'{{enum_values}}'}</code> for its allowed values. Any key
              OTHER than <code>{'{{this_field}}'}</code> in the JSON output lands
              under the thinking domain above.
            </>
          ) : (
            <>
              {' '}Multi-field — emit JSON with one key per wired field
              (<code>{'{{fields_schema}}'}</code> / <code>{'{{fields_current}}'}</code>
              are the multi-field counterparts of single-field <code>{'{{this_field}}'}</code>).
              Any key NOT matching a wired field name lands under the thinking domain above.
            </>
          )}
        </p>
        {expanded ? (
          <PromptPreviewView instance={instance} config={config} agentId={agentId} crewId={crewId}
            rows={14} storageKey={`addon:${instance.instanceId}:prompt`} />
        ) : (
          <MentionTextarea
            value={config.prompt}
            onChange={prompt => patch({ prompt })}
            options={mentionOptions}
            placeholder="Ask about… If the user says X, commit value Y… Type @ for fields/memory, # for parameters, ^ for persona, + for snippets, / for all."
            rows={14}
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        )}
        <SnippetsUsedFooter agentId={agentId} text={config.prompt} />
      </section>

      <WireOrCreateFieldModal
        open={wireOpen}
        onClose={() => setWireOpen(false)}
        agentId={agentId}
        crewId={crewId}
        instanceId={instance.instanceId}
        onWired={handleWired}
        badgeLabel="Field Interviewer"
        allowedTypes={['string', 'enum']}
      />

      <FieldEditorModal
        crewField={editingField}
        onClose={() => setEditFieldId(null)}
        agentId={agentId}
        crewId={crewId}
      />
    </div>
  );
}
