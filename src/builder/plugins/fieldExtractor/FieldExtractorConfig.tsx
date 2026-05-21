/**
 * Field Extractor — config screen.
 *
 *   1. Model + extractor prompt
 *   2. Fields owned by this extractor instance: each row is clickable
 *      to edit, with a hover × for quick remove. + button opens
 *      AddFieldModal locked to this instance.
 *
 * Fields are first-class crew data; the crew-level Fields panel is
 * the canonical home for them, but this modal is convenient when
 * the user is already focused on a specific extractor.
 */

import { useMemo, useState } from 'react';
import { ModelPicker } from '../../components/ModelPicker/ModelPicker';
import { AddFieldModal } from '../../components/FieldsPanel/AddFieldModal';
import { FieldEditorModal } from '../../components/FieldsPanel/FieldEditorModal';
import { useCrewFields } from '../../state/useCrewFields';
import type { CrewField } from '../../state/useCrewFields';
import { useConfirm } from '../../components/Confirm/Confirm';
import type { PluginConfigProps } from '../../registry/plugins';
import type { FieldDef, FieldExtractorConfig } from '../../types';
import styles from './FieldExtractorConfig.module.css';

interface FieldGroup {
  domain: string | null;  // null = ungrouped
  fields: FieldDef[];
}

function groupFieldsByDomain(fields: FieldDef[]): FieldGroup[] {
  const named = new Map<string, FieldDef[]>();
  const orphan: FieldDef[] = [];
  for (const f of fields) {
    const d = f.domain?.trim();
    if (d) {
      if (!named.has(d)) named.set(d, []);
      named.get(d)!.push(f);
    } else {
      orphan.push(f);
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
  const { removeField } = useCrewFields(agentId, crewId);
  const confirm = useConfirm();
  const [addOpen, setAddOpen] = useState(false);
  const [editingField, setEditingField] = useState<CrewField | null>(null);
  const [fieldsOpen, setFieldsOpen] = useState(true);

  const groups = useMemo(() => groupFieldsByDomain(config.fields), [config.fields]);

  const openEdit = (f: FieldDef) => {
    setEditingField({
      field: f,
      extractorInstanceId: instance.instanceId,
      extractorLabel: 'Field Extractor',
    });
  };

  const handleRemove = async (f: FieldDef, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: `Delete field "${f.name || '(unnamed)'}"?`,
      message: 'This removes the field from this extractor.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) removeField(instance.instanceId, f.id);
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.section}>
        <ModelPicker
          value={config.model}
          onChange={model => patch({ model })}
          label="Model"
        />
      </section>

      <section className={styles.section}>
        <label className={styles.sectionLabel} htmlFor="fe-prompt">
          Extractor prompt
        </label>
        <p className={styles.sectionHint}>
          How the model should extract fields — rules like "stay literal", "don't
          guess", "only the latest message".
        </p>
        <textarea
          id="fe-prompt"
          className={styles.textarea}
          value={config.prompt}
          onChange={e => patch({ prompt: e.target.value })}
          placeholder="Extract only what the user explicitly said. Don't guess."
        />
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
              Fields ({config.fields.length})
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

        {fieldsOpen && (config.fields.length === 0 ? (
          <div className={styles.summaryEmpty}>
            No fields yet. Click <strong>+ Add field</strong> to create one.
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
                  {g.fields.map(f => {
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
                          onClick={() => openEdit(f)}
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
                          </span>
                        </button>
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={e => handleRemove(f, e)}
                          aria-label={`Remove ${f.name || 'field'}`}
                          title="Remove field"
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
        lockedExtractorId={instance.instanceId}
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
