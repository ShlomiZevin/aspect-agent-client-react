/**
 * FieldEditorModal — edit a single field.
 *
 * Lets the user change name, type, source, scope, domain (autocomplete
 * + create), enum values, and the set of Field Extractors that
 * extract this field (multi-select across every crew of the agent).
 *
 * Scope change is a *move*: the FieldDef shifts between
 * `agent.fields` and `crew.fields`. The "Extracted by" set is just
 * a toggle into each extractor's `extractsFields[]` — same field id
 * can be ticked in multiple extractors at once.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useCrewFields } from '../../state/useCrewFields';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { DomainInput } from './DomainInput';
import type { CrewField } from '../../state/useCrewFields';
import type { FieldScope, FieldSource, FieldType, ID } from '../../types';
import styles from './AddFieldModal.module.css';

function findLiveValue(
  memory: Record<string, Record<string, unknown>>,
  fieldName: string,
): unknown | undefined {
  for (const bucket of Object.values(memory)) {
    if (bucket && Object.prototype.hasOwnProperty.call(bucket, fieldName)) {
      const v = bucket[fieldName];
      if (v !== null && v !== undefined) return v;
    }
  }
  return undefined;
}

function liveValueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

interface Props {
  crewField: CrewField | null;
  onClose: () => void;
  agentId: ID;
  /** Crew the panel is mounted in (used as the destination crew
   *  if the user changes scope from 'agent' to 'crew'). Empty when
   *  the editor is opened from the AgentView panel. */
  crewId: ID;
}

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum',    label: 'Enum' },
];

const SOURCE_LABEL: Record<FieldSource, { label: string }> = {
  explicit: { label: 'Explicit' },
  inferred: { label: 'Inferred' },
};

export function FieldEditorModal({ crewField, onClose, agentId, crewId }: Props) {
  const { agentExtractors, domainNames, updateField, removeField, setFieldExtractors } =
    useCrewFields(agentId, crewId);
  const { conversationMemory, previewConversationId, updateConversationMemoryField } = useBuilder();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('string');
  const [source, setSource] = useState<FieldSource>('explicit');
  const [scope, setScope] = useState<FieldScope>('agent');
  const [howToExtract, setHowToExtract] = useState('');
  const [enumValues, setEnumValues] = useState('');
  const [domain, setDomain] = useState('');
  const [selectedExtractors, setSelectedExtractors] = useState<Set<ID>>(new Set());
  const [editingLive, setEditingLive] = useState(false);
  const [liveDraft, setLiveDraft] = useState('');

  useEffect(() => {
    if (!crewField) return;
    const f = crewField.field;
    setName(f.name);
    setType(f.type);
    setSource(f.source);
    setScope(crewField.scope);
    setHowToExtract(f.howToExtract);
    setEnumValues((f.enumValues ?? []).join(', '));
    setDomain(f.domain ?? '');
    setSelectedExtractors(new Set(crewField.extractors.map(e => e.instanceId)));
    setEditingLive(false);
  }, [crewField]);

  // Group extractors by crew for the multi-select layout.
  const byCrew = useMemo(() => {
    const groups = new Map<string, { crewName: string; items: typeof agentExtractors }>();
    for (const e of agentExtractors) {
      if (!groups.has(e.crewId)) groups.set(e.crewId, { crewName: e.crewName, items: [] });
      groups.get(e.crewId)!.items.push(e);
    }
    return Array.from(groups.values());
  }, [agentExtractors]);

  if (!crewField) return null;

  const original = crewField.field;
  const liveValue = findLiveValue(conversationMemory, original.name);
  const hasLive = liveValue !== undefined;
  const canEditLive = previewConversationId !== null;

  const startEditLive = () => {
    setLiveDraft(liveValueToString(liveValue));
    setEditingLive(true);
  };
  const saveLive = async () => {
    const raw = liveDraft.trim();
    let v: unknown = raw;
    if (type === 'int') {
      const n = Number(raw);
      v = Number.isFinite(n) ? n : raw;
    } else if (type === 'boolean') {
      v = /^(true|1|yes)$/i.test(raw);
    } else if (type === 'enum' || type === 'string') {
      v = raw;
    }
    await updateConversationMemoryField({
      field: original.name,
      value: v,
      domain: original.domain ?? null,
    });
    setEditingLive(false);
  };
  const clearLive = async () => {
    await updateConversationMemoryField({ field: original.name, clear: true });
    setEditingLive(false);
  };

  const toggleExtractor = (id: ID) => {
    setSelectedExtractors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = () => {
    // 1. Patch + (optionally) move the FieldDef.
    updateField(
      crewField.scope,
      crewField.ownerCrewId,
      original.id,
      {
        name: name.trim(),
        type,
        source,
        howToExtract: howToExtract.trim(),
        domain: domain.trim() || undefined,
        enumValues:
          type === 'enum'
            ? enumValues.split(',').map(v => v.trim()).filter(Boolean)
            : undefined,
      },
      scope !== crewField.scope ? scope : undefined,
    );
    // 2. Sync the "extracted by" set.
    setFieldExtractors(original.id, Array.from(selectedExtractors));
    onClose();
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete field "${original.name || '(unnamed)'}"?`,
      message: 'Removes the field definition and unhooks it from every extractor that references it.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      removeField(crewField.scope, crewField.ownerCrewId, original.id);
      onClose();
    }
  };

  return (
    <Modal
      open={crewField !== null}
      onClose={onClose}
      width={620}
      title={<>📝 {original.name || 'Field'}</>}
      badge={type}
      footer={
        <>
          <button
            type="button"
            className={styles.cancel}
            onClick={remove}
            style={{ marginRight: 'auto', color: '#dc2626', borderColor: '#fecaca' }}
          >
            Delete
          </button>
          <button type="button" className={styles.cancel} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.save}
            onClick={save}
            disabled={!name.trim() || selectedExtractors.size === 0}
            title={selectedExtractors.size === 0 ? 'Pick at least one extractor' : undefined}
          >
            Save
          </button>
        </>
      }
    >
      <div className={styles.form}>
        {canEditLive && (
          <div className={styles.liveBlock}>
            <div className={styles.liveHeader}>
              <span className={styles.liveLabel}>Current value (this chat)</span>
              {hasLive && !editingLive && (
                <div className={styles.liveActions}>
                  <button type="button" className={styles.liveBtn} onClick={startEditLive}>Edit</button>
                  <button type="button" className={`${styles.liveBtn} ${styles.liveBtnDanger}`} onClick={clearLive}>Clear</button>
                </div>
              )}
              {!hasLive && !editingLive && (
                <button type="button" className={styles.liveBtn} onClick={startEditLive}>Set value</button>
              )}
            </div>
            {editingLive ? (
              <div className={styles.liveEditRow}>
                <input
                  className={styles.input}
                  value={liveDraft}
                  onChange={e => setLiveDraft(e.target.value)}
                  placeholder={`Enter ${type} value`}
                  autoFocus
                />
                <button type="button" className={styles.liveSave} onClick={saveLive}>Save value</button>
                <button type="button" className={styles.liveBtn} onClick={() => setEditingLive(false)}>Cancel</button>
              </div>
            ) : (
              <div className={styles.liveValueChip}>
                {hasLive ? liveValueToString(liveValue) : <em className={styles.liveEmpty}>—</em>}
              </div>
            )}
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </label>

        <div className={styles.row3}>
          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <select
              className={styles.input}
              value={type}
              onChange={e => setType(e.target.value as FieldType)}
            >
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Source</span>
            <select
              className={styles.input}
              value={source}
              onChange={e => setSource(e.target.value as FieldSource)}
            >
              {(['explicit', 'inferred'] as FieldSource[]).map(s => (
                <option key={s} value={s}>{SOURCE_LABEL[s].label}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Scope</span>
            <select
              className={styles.input}
              value={scope}
              onChange={e => setScope(e.target.value as FieldScope)}
              title="Where this field lives in JSON"
              disabled={scope === 'crew' && !crewId}
            >
              <option value="agent">Agent — visible everywhere</option>
              <option value="crew">Crew — only in this crew</option>
            </select>
          </label>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Domain</span>
          <DomainInput
            value={domain}
            onChange={setDomain}
            options={domainNames}
            onSubmit={() => {
              if (name.trim() && selectedExtractors.size > 0) save();
            }}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>How to extract</span>
          <textarea
            className={styles.textarea}
            value={howToExtract}
            onChange={e => setHowToExtract(e.target.value)}
            placeholder="What this field means. Don't list allowed enum values here — they're injected automatically."
          />
        </label>

        {type === 'enum' && (
          <label className={styles.field}>
            <span className={styles.label}>Allowed values (comma-separated)</span>
            <input
              className={styles.input}
              value={enumValues}
              onChange={e => setEnumValues(e.target.value)}
              placeholder="e.g. salaried, self_employed, unemployed, retired"
            />
          </label>
        )}

        {/* ── Extracted-by multi-select ─────────────────────────── */}
        <div className={styles.field}>
          <span className={styles.label}>Extracted by</span>
          {agentExtractors.length === 0 ? (
            <div className={styles.hintBlock}>
              No Field Extractors anywhere in this agent yet. Add one
              to a crew's chain before this field can be extracted.
            </div>
          ) : (
            <div className={styles.extractorPickGroups}>
              {byCrew.map(group => (
                <div key={group.crewName} className={styles.extractorPickGroup}>
                  <div className={styles.extractorPickCrew}>{group.crewName}</div>
                  <div className={styles.extractorPickChips}>
                    {group.items.map(e => {
                      const active = selectedExtractors.has(e.instanceId);
                      return (
                        <button
                          key={e.instanceId}
                          type="button"
                          className={`${styles.extractorPickChip} ${active ? styles.extractorPickChipActive : ''}`}
                          onClick={() => toggleExtractor(e.instanceId)}
                        >
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {selectedExtractors.size > 1 && (
            <span className={styles.note}>
              Multiple extractors will write to the same memory slot for "{name}". Last one to fire per turn wins.
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
