/**
 * Field Reasoner — config screen (v2: prompt-first).
 *
 * The reasoning prompt is the heart of the addon; everything else gets
 * a compact row. Field declaration lives behind a single "Wire / Create"
 * button that opens WireOrCreateFieldModal — the user picks an
 * existing eligible field OR creates a new one with Reasoner-
 * appropriate defaults (`source: inferred`, configurable type / scope /
 * domain / enum values). Selecting either path patches
 * `config.extractsFields = [id]` and surfaces a chip in the row.
 *
 * Why a modal (vs the v1 inline form): the inline form pushed the
 * reasoning prompt below the fold and made the addon feel like a
 * field-shape editor. The prompt is what authors actually iterate on;
 * the field declaration is a one-time setup.
 */

import { useMemo, useState } from 'react';
import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import { InlineField } from '../../components/AddonModal/InlineField';
import { FieldEditorModal } from '../../components/FieldsPanel/FieldEditorModal';
import { SnippetsUsedFooter } from '../../components/Snippets/SnippetsUsedFooter';
import { useSnippetCreator } from '../../components/Snippets/SnippetCreator';
import { ExpandPromptToggle } from '../../components/Snippets/ExpandPromptToggle';
import { ExpandedPromptView } from '../../components/Snippets/ExpandedPromptView';
import { useCrewFields } from '../../state/useCrewFields';
import type { PluginConfigProps } from '../../registry/plugins';
import type { FieldReasonerConfig, ID } from '../../types';
import { WireOrCreateFieldModal } from './WireOrCreateFieldModal';
import styles from './FieldReasonerConfig.module.css';

export function FieldReasonerConfigComponent({
  config,
  onChange,
  instance,
  agentId,
  crewId,
}: PluginConfigProps<FieldReasonerConfig>) {
  const patch = (next: Partial<FieldReasonerConfig>) => onChange({ ...config, ...next });
  const linkedIds: ID[] = config.extractsFields ?? [];
  // `{{this_field}}` / `{{enum_values}}` resolve to the FIRST bound
  // field — that's the single-field token convention. Pass it as the
  // boundField hint so the picker descriptions reflect the right
  // field's name / values when there are multiple.
  const firstLinkedId: ID | undefined = linkedIds[0];
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, {
    boundField: { fieldId: firstLinkedId },
    onCreateSnippet: () => openCreateSnippet(agentId),
  });
  const { allFields, setFieldExtractors } = useCrewFields(agentId, crewId);
  const linkedFields = useMemo(
    () => linkedIds
      .map(id => allFields.find(cf => cf.field.id === id) ?? null)
      .filter((x): x is NonNullable<typeof x> => x !== null),
    [allFields, linkedIds],
  );

  const [expanded, setExpanded] = useState(false);
  const [wireOpen, setWireOpen] = useState(false);
  const [editFieldId, setEditFieldId] = useState<ID | null>(null);
  const editingField = useMemo(
    () => editFieldId ? allFields.find(cf => cf.field.id === editFieldId) ?? null : null,
    [allFields, editFieldId],
  );

  /** Append: WireOrCreateFieldModal returns one fieldId per pick/create. */
  const handleWired = (fieldId: ID) => {
    if (linkedIds.includes(fieldId)) return;
    patch({ extractsFields: [...linkedIds, fieldId] });
  };

  /** Remove just this field from the wired set. Also clears this addon
   *  from the field's `extractors[]` so the schema view stays accurate. */
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
        hint="Shown on the chain card. Leave blank for the default (Field Reasoner #N)."
      >
        <input
          className={styles.input}
          value={config.name ?? ''}
          onChange={e => patch({ name: e.target.value })}
          placeholder="e.g. Tier Reasoner"
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
            ? `Multi-field Reasoner — outputs JSON with one key per field. {{this_field}} and {{enum_values}} resolve to "${linkedFields[0].field.name}" (the first field).`
            : 'Field(s) this Reasoner populates. Wire one for a focused reasoner, or several to populate related fields in one call.'
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
                <span className={styles.linkedIcon}>🧠</span>
                <span className={styles.linkedName}>{lf.field.name}</span>
                <span className={styles.linkedType}>{lf.field.type}</span>
                {lf.scope === 'crew' && <span className={styles.linkedScope}>crew</span>}
              </button>
              <button
                type="button"
                className={styles.unlinkBtn}
                onClick={() => handleUnlink(lf.field.id)}
                title={`Unlink ${lf.field.name} — keeps the field declaration but stops this Reasoner from populating it`}
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

      <section className={styles.promptSection}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <label className={styles.promptLabel} htmlFor="fr-prompt">
            Reasoning prompt
          </label>
          <ExpandPromptToggle
            text={config.prompt}
            expanded={expanded}
            onToggle={setExpanded}
          />
        </div>
        <p className={styles.promptHint}>
          Describe how to decide. Reference other fields inline with <code>@</code>,
          parameters with <code>#</code>, persona with <code>^</code>.
          {linkedFields.length <= 1 ? (
            <>
              {' '}Use <code>{'{{this_field}}'}</code> for the output field's name and
              <code> {'{{enum_values}}'}</code> for its allowed values.
            </>
          ) : (
            <>
              {' '}Multi-field — emit JSON with one key per wired field
              (<code>{'{{fields_schema}}'}</code> / <code>{'{{fields_current}}'}</code>
              tokens are the multi-field counterpart of single-field <code>{'{{this_field}}'}</code>).
            </>
          )}
        </p>
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
            placeholder="If @intent is complaint and @tier is enterprise, lean toward... Type @ for fields/memory, # for parameters, ^ for persona, + for snippets, / for all."
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
