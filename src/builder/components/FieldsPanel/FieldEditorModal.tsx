/**
 * FieldEditorModal — edit a single field.
 *
 * Lets the user change name, type, source, how-to-extract, domain
 * (autocomplete + create), enum values, and **re-parent** the field
 * to a different extractor. When re-parenting and the current source
 * isn't allowed by the new owner, we coerce to the new owner's
 * default and show a small note.
 */

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal/Modal';
import { useCrewFields } from '../../state/useCrewFields';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { getPlugin } from '../../registry/plugins';
import { DomainInput } from './DomainInput';
import type { CrewField } from '../../state/useCrewFields';
import type { FieldSource, FieldType, ID } from '../../types';
import styles from './AddFieldModal.module.css';

/** Pluck a field's live value out of the conversation memory blob. */
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
  const { extractors, extractorOptions, domainNames, updateField, moveField, removeField } =
    useCrewFields(agentId, crewId);
  const { conversationMemory, previewConversationId, updateConversationMemoryField } = useBuilder();
  const confirm = useConfirm();

  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('string');
  const [source, setSource] = useState<FieldSource>('explicit');
  const [howToExtract, setHowToExtract] = useState('');
  const [enumValues, setEnumValues] = useState('');
  const [domain, setDomain] = useState('');
  const [targetId, setTargetId] = useState<ID>('');
  const [coercedNote, setCoercedNote] = useState<string | null>(null);

  // Live-value editing state. `editingLive=true` swaps the read-only
  // chip for an input; saving writes to conversation memory.
  const [editingLive, setEditingLive] = useState(false);
  const [liveDraft, setLiveDraft] = useState('');

  useEffect(() => {
    if (!crewField) return;
    const f = crewField.field;
    setName(f.name);
    setType(f.type);
    setSource(f.source);
    setHowToExtract(f.howToExtract);
    setEnumValues((f.enumValues ?? []).join(', '));
    setDomain(f.domain ?? '');
    setTargetId(crewField.extractorInstanceId);
    setCoercedNote(null);
    setEditingLive(false);
  }, [crewField]);

  // Sources allowed by the currently-targeted extractor.
  const allowedSources: FieldSource[] = useMemo(() => {
    const inst = extractors.find(e => e.instanceId === targetId);
    if (!inst) return ['explicit', 'inferred'];
    const desc = getPlugin(inst.pluginId);
    return desc?.allowedFieldSources ?? ['explicit', 'inferred'];
  }, [targetId, extractors]);

  // Coerce source if the new owner doesn't allow it. Note the change.
  useEffect(() => {
    if (!crewField) return;
    if (!allowedSources.includes(source)) {
      const next = allowedSources[0];
      setSource(next);
      setCoercedNote(
        `Source coerced to "${SOURCE_LABEL[next].label}" — this extractor doesn't allow others.`,
      );
    } else {
      setCoercedNote(null);
    }
  }, [allowedSources, source, crewField]);

  if (!crewField) return null;

  const original = crewField.field;
  const originalExtractorId = crewField.extractorInstanceId;
  const liveValue = findLiveValue(conversationMemory, original.name);
  const hasLive = liveValue !== undefined;
  const canEditLive = previewConversationId !== null;

  const startEditLive = () => {
    setLiveDraft(liveValueToString(liveValue));
    setEditingLive(true);
  };

  const saveLive = async () => {
    // Coerce to the declared field type for non-strings; on parse
    // failure fall through as a raw string so the user isn't blocked.
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

  const save = () => {
    if (targetId !== originalExtractorId) {
      moveField(original.id, originalExtractorId, targetId);
    }
    const ownerId = targetId || originalExtractorId;
    updateField(ownerId, original.id, {
      name: name.trim(),
      type,
      source,
      howToExtract: howToExtract.trim(),
      domain: domain.trim() || undefined,
      enumValues:
        type === 'enum'
          ? enumValues.split(',').map(v => v.trim()).filter(Boolean)
          : undefined,
    });
    onClose();
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete field "${original.name || '(unnamed)'}"?`,
      message: 'This removes the field from its Field Extractor.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      removeField(originalExtractorId, original.id);
      onClose();
    }
  };

  return (
    <Modal
      open={crewField !== null}
      onClose={onClose}
      width={560}
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
            disabled={!name.trim()}
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
                  <button type="button" className={styles.liveBtn} onClick={startEditLive}>
                    Edit
                  </button>
                  <button type="button" className={`${styles.liveBtn} ${styles.liveBtnDanger}`} onClick={clearLive}>
                    Clear
                  </button>
                </div>
              )}
              {!hasLive && !editingLive && (
                <button type="button" className={styles.liveBtn} onClick={startEditLive}>
                  Set value
                </button>
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
                <button type="button" className={styles.liveSave} onClick={saveLive}>
                  Save value
                </button>
                <button type="button" className={styles.liveBtn} onClick={() => setEditingLive(false)}>
                  Cancel
                </button>
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
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Source</span>
            <select
              className={styles.input}
              value={source}
              onChange={e => setSource(e.target.value as FieldSource)}
            >
              {allowedSources.map(s => (
                <option key={s} value={s}>{SOURCE_LABEL[s].label}</option>
              ))}
            </select>
          </label>

          {extractorOptions.length > 1 && (
            <label className={styles.field}>
              <span className={styles.label}>Extracted by</span>
              <select
                className={styles.input}
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
              >
                {extractorOptions.map(o => (
                  <option key={o.instanceId} value={o.instanceId}>{o.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {coercedNote && <p className={styles.note}>{coercedNote}</p>}

        <label className={styles.field}>
          <span className={styles.label}>Domain</span>
          <DomainInput
            value={domain}
            onChange={setDomain}
            options={domainNames}
            onSubmit={() => {
              if (name.trim()) save();
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
      </div>
    </Modal>
  );
}
