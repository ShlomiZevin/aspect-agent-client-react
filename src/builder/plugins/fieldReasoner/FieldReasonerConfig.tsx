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
  const linkedId: ID | undefined = config.extractsFields?.[0];
  // Opt into the picker's "Output field" group so {{this_field}} /
  // {{enum_values}} surface under @ (and the universal `/`) with the
  // currently-bound field's name + values shown in the descriptions.
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, {
    boundField: { fieldId: linkedId },
    onCreateSnippet: () => openCreateSnippet(agentId),
  });
  const { allFields } = useCrewFields(agentId, crewId);
  const linked = useMemo(
    () => allFields.find(cf => cf.field.id === linkedId) ?? null,
    [allFields, linkedId],
  );

  const [expanded, setExpanded] = useState(false);
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
        label="Output field"
        hint="The single field this Reasoner populates. Pick an existing one or create a new one."
      >
        {linked ? (
          <div className={styles.linkedRow}>
            <button
              type="button"
              className={styles.linkedChip}
              onClick={() => setEditOpen(true)}
              title={`Edit the declaration of ${linked.field.name}`}
            >
              <span className={styles.linkedIcon}>🧠</span>
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
              title="Unlink — keeps the field declaration but stops this Reasoner from populating it"
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
          parameters with <code>#</code>, persona with <code>^</code>. Use
          <code> {'{{this_field}}'} </code> for the output field's name and
          <code> {'{{enum_values}}'} </code> for its allowed values.
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
