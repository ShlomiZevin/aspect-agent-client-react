/**
 * Field Extractor — config screen.
 *
 *   1. Name (user-editable label, e.g. "Date Extractor" / "Intent Extractor")
 *   2. Model + extractor prompt
 *   3. Fields this extractor EXTRACTS (lookup of `extractsFields[]`
 *      against `agent.fields` ∪ this crew's `crew.fields`). Clicking
 *      a row opens the field editor; × removes the field id from
 *      THIS extractor's list (doesn't delete the field definition).
 *      "+ Add field" opens AddFieldModal pre-ticking this extractor.
 */

import { useMemo, useState } from 'react';
import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { AddFieldModal } from '../../components/FieldsPanel/AddFieldModal';
import { FieldEditorModal } from '../../components/FieldsPanel/FieldEditorModal';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import { useMentionOptions } from '../../components/MentionTextarea/useMentionOptions';
import { InlineField } from '../../components/AddonModal/InlineField';
import { SnippetsUsedFooter } from '../../components/Snippets/SnippetsUsedFooter';
import { useSnippetCreator } from '../../components/Snippets/SnippetCreator';
import { ExpandPromptToggle } from '../../components/Snippets/ExpandPromptToggle';
import { ExpandedPromptView } from '../../components/Snippets/ExpandedPromptView';
import { useCrewFields } from '../../state/useCrewFields';
import type { CrewField } from '../../state/useCrewFields';
import type { PluginConfigProps } from '../../registry/plugins';
import { getPlugin } from '../../registry/plugins';
import type { FieldDef, FieldExtractorConfig, FieldSource } from '../../types';
import styles from './FieldExtractorConfig.module.css';

interface FieldGroup {
  domain: string | null;
  fields: CrewField[];
}

function groupByDomain(fields: CrewField[]): FieldGroup[] {
  const named = new Map<string, CrewField[]>();
  const orphan: CrewField[] = [];
  for (const cf of fields) {
    const d = cf.field.domain?.trim();
    if (d) {
      if (!named.has(d)) named.set(d, []);
      named.get(d)!.push(cf);
    } else {
      orphan.push(cf);
    }
  }
  const out: FieldGroup[] = [...named.entries()].map(([domain, fields]) => ({ domain, fields }));
  if (orphan.length > 0) out.push({ domain: null, fields: orphan });
  return out;
}

const TYPE_LABEL: Record<string, string> = {
  string: 'string',
  int: 'int',
  enum: 'enum',
  boolean: 'bool',
};

const SOURCE_LABEL: Record<string, { label: string; icon: string }> = {
  explicit: { label: 'Explicit', icon: '🗣️' },
  inferred: { label: 'Inferred', icon: '🧐' },
};

export function FieldExtractorConfigComponent({
  config,
  onChange,
  instance,
  agentId,
  crewId,
}: PluginConfigProps<FieldExtractorConfig>) {
  const patch = (next: Partial<FieldExtractorConfig>) => onChange({ ...config, ...next });
  const { allFields, setFieldExtractors } = useCrewFields(agentId, crewId);
  const openCreateSnippet = useSnippetCreator();
  const mentionOptions = useMentionOptions(agentId, {
    onCreateSnippet: () => openCreateSnippet(agentId),
  });
  const [addOpen, setAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<CrewField | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // The CrewField objects this extractor extracts. Resolved by
  // intersecting `config.extractsFields[]` with the crew-visible
  // field set (agent fields + this crew's crew-scoped fields).
  const extractedFields = useMemo<CrewField[]>(() => {
    const ids = new Set(config.extractsFields || []);
    return allFields.filter(cf => ids.has(cf.field.id));
  }, [allFields, config.extractsFields]);

  const groups = useMemo(() => groupByDomain(extractedFields), [extractedFields]);

  /**
   * Remove a field from THIS extractor's `extractsFields` (does not
   * delete the field definition itself — the def lives on
   * agent/crew and may be used by other extractors).
   */
  const removeFromExtractor = (fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Find current set across the agent, then drop this extractor
    // from it for that field id.
    const cf = allFields.find(x => x.field.id === fieldId);
    if (!cf) return;
    const next = cf.extractors
      .map(x => x.instanceId)
      .filter(id => id !== instance.instanceId);
    setFieldExtractors(fieldId, next);
  };

  return (
    <div className={styles.wrap}>
      <InlineField
        label="Name"
        htmlFor="fe-name"
        hint="Shown on the chain card. Leave blank for the default (Field Extractor #N)."
      >
        <input
          id="fe-name"
          className={styles.input}
          value={config.name ?? ''}
          onChange={e => patch({ name: e.target.value })}
          placeholder="e.g. Date Extractor"
          spellCheck={false}
        />
      </InlineField>

      <InlineField label="Model" hint="LLM used for this addon's call.">
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
        />
      </InlineField>

      <section className={styles.section}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <label className={styles.sectionLabel} htmlFor="fe-prompt">
            Extractor prompt
          </label>
          <ExpandPromptToggle
            text={config.prompt}
            expanded={expanded}
            onToggle={setExpanded}
          />
        </div>
        <p className={styles.sectionHint}>
          How the model should extract fields — rules like "stay literal", "don't
          guess", "only the latest message".
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
            placeholder="Extract only what the user explicitly said. Don't guess. Type @ memory · # parameters · ^ persona · * dynamic · + snippets · / or {{ for all."
            rows={10}
            storageKey={`addon:${instance.instanceId}:prompt`}
          />
        )}
        <SnippetsUsedFooter agentId={agentId} text={config.prompt} />
      </section>

      <section className={styles.collapsibleSection}>
        <div className={styles.collapsibleHeader}>
          <button
            type="button"
            className={styles.collapsibleToggle}
            onClick={() => setFieldsOpen(o => !o)}
          >
            <span className={styles.caret}>{fieldsOpen ? '▾' : '▸'}</span>
            <span className={styles.sectionLabel}>
              Fields this extractor extracts ({extractedFields.length})
            </span>
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setAddOpen(true)}
          >
            + Add field
          </button>
        </div>

        {fieldsOpen && (extractedFields.length === 0 ? (
          <div className={styles.summaryEmpty}>
            This extractor doesn't extract anything yet. Click <strong>+ Add field</strong> to
            define a new one (and tick this extractor) — or open an existing field from the
            Memory panel and add this extractor to its "Extracted by" list.
          </div>
        ) : (
          <div className={styles.groups}>
            {groups.map((g, idx) => (
              <div
                key={g.domain ?? '__ungrouped__'}
                className={g.domain === null ? styles.ungrouped : styles.group}
              >
                {g.domain !== null && (
                  <div className={styles.groupHeader}>
                    <span className={styles.groupName}>{g.domain}</span>
                    <span className={styles.groupCount}>{g.fields.length}</span>
                  </div>
                )}
                {g.domain === null && idx > 0 && <div className={styles.dashed} />}
                <ul className={styles.summaryList}>
                  {g.fields.map(cf => {
                    const f: FieldDef = cf.field;
                    const src = SOURCE_LABEL[f.source];
                    return (
                      <li
                        key={f.id}
                        className={styles.summaryRow}
                        title={f.howToExtract || undefined}
                      >
                        <button
                          type="button"
                          className={styles.summaryRowBtn}
                          onClick={() => setEditingField(cf)}
                        >
                          <span className={styles.summaryName}>
                            {f.name || '(unnamed)'}
                          </span>
                          <span className={styles.summaryPills}>
                            <span className={styles.summaryType}>
                              {TYPE_LABEL[f.type] ?? f.type}
                            </span>
                            <span className={styles.summarySource} title={src?.label}>
                              {src?.icon ?? ''} {src?.label ?? f.source}
                            </span>
                            {cf.scope === 'crew' && (
                              <span className={styles.summarySource} title="Crew-scoped">
                                🔒 crew
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={e => removeFromExtractor(f.id, e)}
                          aria-label={`Stop ${instance.instanceId} from extracting ${f.name || 'field'}`}
                          title="Remove from this extractor (field definition stays)"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>

      <AddFieldModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        agentId={agentId}
        crewId={crewId}
        // Anchor the new field to THIS extractor instance with the
        // plugin-preferred default source (first entry in the plugin
        // descriptor's `allowedFieldSources`). So adding a field from
        // a Vibe Extractor starts ticked + 'inferred', from a Field
        // Extractor starts ticked + 'explicit'. Future extractor
        // plugins inherit this behavior just by ordering their
        // `allowedFieldSources` array.
        fromExtractor={{
          instanceId: instance.instanceId,
          defaultSource:
            (getPlugin(instance.pluginId)?.allowedFieldSources?.[0] as FieldSource | undefined)
            ?? 'explicit',
        }}
      />

      <FieldEditorModal
        crewField={editingField}
        onClose={() => setEditingField(null)}
        agentId={agentId}
        crewId={crewId}
      />
    </div>
  );
}
