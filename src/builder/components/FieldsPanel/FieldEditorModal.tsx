/**
 * FieldEditorModal — edit a single field.
 *
 * Lets the user change name, type, source, domain (autocomplete +
 * create), enum values, and the set of Field Extractors that extract
 * this field (multi-select across every crew of the agent).
 *
 * Scope is intentionally NOT editable here: the "declare at agent
 * level + wire to crews" model made crew-scoped fields equivalent
 * to "declared once, wired only to one crew", so the choice became
 * redundant. Legacy crew-scoped fields keep working and stay where
 * they live; the editor just stops offering the move.
 *
 * The "Extracted by" set is a toggle into each extractor's
 * `extractsFields[]` — same field id can be ticked in multiple
 * extractors at once.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../Modal/Modal';
import { useCrewFields } from '../../state/useCrewFields';
import { useBuilder } from '../../state/BuilderContext';
import { useConfirm } from '../Confirm/Confirm';
import { DomainInput } from './DomainInput';
import {
  validateFieldName,
  stripInvalid,
  hadInvalidStripped,
  SPACE_BLOCKED_MESSAGE,
} from './fieldNameValidation';
import type { CrewField } from '../../state/useCrewFields';
import type { FieldSource, FieldType, ID } from '../../types';
import { autoDir } from '../../../utils/textDirection';
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
  /** Crew the panel is mounted in. Passed to `useCrewFields` so the
   *  extractor multi-select sees the right pool of available extractors.
   *  Empty when the editor is opened from a non-crew context. */
  crewId: ID;
}

/** Primitive types that appear at the top of the unified Type select.
 *  `enum` is intentionally NOT here — picking an enum means picking a
 *  SPECIFIC enum from the bible, which is surfaced as its own optgroup
 *  underneath. */
const PRIMITIVE_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

const SOURCE_LABEL: Record<FieldSource, { label: string }> = {
  explicit: { label: 'Explicit' },
  inferred: { label: 'Inferred' },
};

export function FieldEditorModal({ crewField, onClose, agentId, crewId }: Props) {
  const { agentExtractors, domainNames, updateField, removeField, setFieldExtractors } =
    useCrewFields(agentId, crewId);
  const { conversationMemory, previewConversationId, updateConversationMemoryField, doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);
  const confirm = useConfirm();

  const [name, setName] = useState('');
  // True when the user's last Name keystroke contained whitespace we
  // silently stripped — drives the inline SPACE_BLOCKED_MESSAGE.
  const [nameSpaceBlocked, setNameSpaceBlocked] = useState(false);
  const [type, setType] = useState<FieldType>('string');
  const [source, setSource] = useState<FieldSource>('explicit');
  const [howToExtract, setHowToExtract] = useState('');
  const [definition, setDefinition] = useState('');
  const [enumType, setEnumType] = useState<ID | ''>('');
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
    setHowToExtract(f.howToExtract);
    setDefinition(f.definition ?? '');
    setEnumType((f.enumType ?? '') as ID | '');
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
  // FieldEditorModal edits memory-side fields. Thinker output lives in
  // conversationMemory.thinking and isn't edited from this modal.
  const liveValue = findLiveValue(conversationMemory.memory, original.name);
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
    // 1. Patch the FieldDef in place. Scope moves are no longer
    //    user-controllable from this modal — the "declare at agent
    //    level + wire to crews" model removed the choice. Legacy
    //    crew-scoped fields stay where they are.
    updateField(
      crewField.scope,
      crewField.ownerCrewId,
      original.id,
      {
        name: name.trim(),
        type,
        source,
        howToExtract: howToExtract.trim(),
        definition:   definition.trim() || undefined,
        domain: domain.trim() || undefined,
        enumType: type === 'enum' && enumType ? enumType : undefined,
      },
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

        {(() => {
          const nv = name.trim().length > 0
            ? validateFieldName(name)
            : { ok: true, reason: '' };
          const showInvalid = !nv.ok || nameSpaceBlocked;
          return (
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input
                className={`${styles.input} ${showInvalid ? styles.inputInvalid : ''}`}
                value={name}
                onChange={e => {
                  const raw = e.target.value;
                  setNameSpaceBlocked(hadInvalidStripped(raw));
                  setName(stripInvalid(raw));
                }}
                autoFocus
              />
              {/* Always rendered — see .nameWarning min-height. The
                  space-block message takes priority over the shape
                  warning since it's immediate keystroke feedback. */}
              <div className={styles.nameWarning}>
                {nameSpaceBlocked
                  ? SPACE_BLOCKED_MESSAGE
                  : !nv.ok
                    ? nv.reason
                    : ''}
              </div>
            </label>
          );
        })()}

        <div className={styles.row3}>
          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <select
              className={styles.input}
              // Encoded value: primitives use their plain name; enums are
              // "enum:<id>" so a single change handler can set both type
              // AND enumType without a separate dropdown below.
              value={type === 'enum' && enumType ? `enum:${enumType}` : type}
              onChange={e => {
                const v = e.target.value;
                if (v.startsWith('enum:')) {
                  setType('enum');
                  setEnumType(v.slice('enum:'.length) as ID);
                } else {
                  setType(v as FieldType);
                  setEnumType('');
                }
              }}
            >
              {PRIMITIVE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
              {(agent?.enums?.length ?? 0) > 0 && (
                <optgroup label="Enums">
                  {(agent?.enums ?? []).map(en => (
                    <option key={en.id} value={`enum:${en.id}`}>{en.name}</option>
                  ))}
                </optgroup>
              )}
              {/* The currently-bound enum was deleted off the bible.
                  Surface the orphan so the user sees the broken state
                  and can re-pick a real one. */}
              {type === 'enum'
                && enumType
                && !(agent?.enums ?? []).some(en => en.id === enumType)
                && (
                  <option value={`enum:${enumType}`}>(missing enum)</option>
                )}
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

        </div>

        {/* Enum preview strip — shows the value vocabulary the user
            just bound, with a shortcut to edit the enum bible. The
            unified Type select above already wires both type and
            enumType together; this block is purely informative. */}
        {type === 'enum' && enumType && agent && (() => {
          const en = (agent.enums ?? []).find(e => e.id === enumType);
          if (!en) {
            return (
              <div className={styles.enumPreviewError}>
                Bound enum "{enumType}" no longer exists on the bible — pick a current one above.
              </div>
            );
          }
          const valueNames = (en.values ?? [])
            .map(v => v?.value)
            .filter((v): v is string => typeof v === 'string' && v.length > 0);
          return (
            <div className={styles.enumPreview}>
              <span className={styles.enumPreviewLabel}>{en.name}</span>
              {valueNames.length > 0 ? (
                <span className={styles.enumPreviewValues}>
                  {valueNames.join(' · ')}
                </span>
              ) : (
                <span className={styles.enumPreviewEmpty}>
                  No values declared on the bible yet
                </span>
              )}
              <Link
                to={`/${agent.slug}/builder/enums/${encodeURIComponent(en.name)}`}
                onClick={onClose}
                className={styles.enumPreviewLink}
              >
                Edit enum ↗
              </Link>
            </div>
          );
        })()}

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
          <span className={styles.label}>
            Definition
            <span className={styles.labelSub}> · for you, never sent to the LLM</span>
          </span>
          <textarea
            className={styles.textarea}
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            placeholder="Your own note about what this field means. Builder-only — the runtime never reads it."
            dir={autoDir(definition)}
            rows={2}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>How to extract</span>
          <textarea
            className={styles.textarea}
            value={howToExtract}
            onChange={e => setHowToExtract(e.target.value)}
            placeholder="What this field means. Don't list allowed enum values here — they're injected automatically."
            dir={autoDir(howToExtract)}
          />
        </label>

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
