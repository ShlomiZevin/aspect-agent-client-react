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
import { useCrewFields } from '../../state/useCrewFields';
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
  const linkedId: ID | undefined = config.extractsFields?.[0];
  // Same opt-in as Field Reasoner — exposes {{this_field}} and
  // {{enum_values}} under the `@` trigger (and `/`) with descriptions
  // tied to whatever field is currently wired.
  const mentionOptions = useMentionOptions(agentId, { boundField: { fieldId: linkedId } });
  const { allFields } = useCrewFields(agentId, crewId);
  const linked = useMemo(
    () => allFields.find(cf => cf.field.id === linkedId) ?? null,
    [allFields, linkedId],
  );

  const [wireOpen, setWireOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleWired = (fieldId: ID) => {
    patch({ extractsFields: [fieldId] });
  };

  const handleUnlink = () => {
    patch({ extractsFields: [] });
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
        label="Output field"
        hint="The single field this Interviewer drives toward. Pick an existing one or create a new one."
      >
        {linked ? (
          <div className={styles.linkedRow}>
            <button
              type="button"
              className={styles.linkedChip}
              onClick={() => setEditOpen(true)}
              title={`Edit the declaration of ${linked.field.name}`}
            >
              <span className={styles.linkedIcon}>🎤</span>
              <span className={styles.linkedName}>{linked.field.name}</span>
              <span className={styles.linkedType}>{linked.field.type}</span>
              {linked.scope === 'crew' && <span className={styles.linkedScope}>crew</span>}
            </button>
            <button
              type="button"
              className={styles.changeBtn}
              onClick={() => setWireOpen(true)}
            >
              Change
            </button>
            <button
              type="button"
              className={styles.unlinkBtn}
              onClick={handleUnlink}
              title="Unlink — keeps the field declaration but stops this Interviewer from populating it"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.wireBtn}
            onClick={() => setWireOpen(true)}
          >
            + Wire or create field
          </button>
        )}
      </InlineField>

      <InlineField
        label="Thinking domain"
        hint={`Where non-field keys land in the brain. Read downstream with {{thinking:${config.domain || 'interview'}}}.`}
      >
        <input
          className={styles.input}
          value={config.domain ?? 'interview'}
          onChange={e => patch({ domain: e.target.value })}
          placeholder="interview"
          spellCheck={false}
        />
      </InlineField>

      <section className={styles.promptSection}>
        <label className={styles.promptLabel} htmlFor="fi-prompt">
          Interview prompt
        </label>
        <p className={styles.promptHint}>
          Tell the LLM how to decide what to ask next AND when to commit
          a value. Use <code>{'{{this_field}}'}</code> for the output
          field's name and <code>{'{{enum_values}}'}</code> for its
          allowed values. Any key OTHER than <code>{'{{this_field}}'}</code> in the
          JSON output lands under the thinking domain above.
        </p>
        <MentionTextarea
          value={config.prompt}
          onChange={prompt => patch({ prompt })}
          options={mentionOptions}
          placeholder="Ask about… If the user says X, commit value Y… Type @ for fields/memory, # for parameters, ^ for persona, / for all."
          rows={14}
        />
      </section>

      <WireOrCreateFieldModal
        open={wireOpen}
        onClose={() => setWireOpen(false)}
        agentId={agentId}
        crewId={crewId}
        instanceId={instance.instanceId}
        onWired={handleWired}
        badgeLabel="Field Interviewer"
      />

      <FieldEditorModal
        crewField={editOpen ? linked : null}
        onClose={() => setEditOpen(false)}
        agentId={agentId}
        crewId={crewId}
      />
    </div>
  );
}
