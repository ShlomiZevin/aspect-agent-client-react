/**
 * SchemaFieldModal — declare an agent-level field without wiring it
 * to an extractor.
 *
 * Why a separate modal from AddFieldModal: AddFieldModal lives inside a
 * crew context and requires you to pick (or auto-create) at least one
 * Field Extractor for the new field. From the agent-level Schema panel
 * there isn't a crew context yet — the user is shaping the data model
 * before deciding which crew should populate it. So declaration and
 * collection are decoupled:
 *
 *   - Schema panel declares (this modal) → field lands in `agent.fields`
 *     with no extractor references. Inert at runtime.
 *   - Crew view "collects" it later (existing FieldEditorModal
 *     extractor multi-select) → user wires the declared field to an
 *     extractor in a specific crew, and only then does memory start
 *     populating with its values.
 *
 * Domain autocomplete reuses the declared `agent.domains` list (plus
 * any in-use names) so the user can slot the field into a pre-shaped
 * group immediately.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../Modal/Modal';
import { useBuilder } from '../../state/BuilderContext';
import { useAgentFields } from '../../state/useAgentFields';
import { useCrewFields } from '../../state/useCrewFields';
import { useConfirm } from '../Confirm/Confirm';
import { DomainInput } from '../FieldsPanel/DomainInput';
import {
  validateFieldName,
  stripInvalid,
  hadInvalidStripped,
  SPACE_BLOCKED_MESSAGE,
} from '../FieldsPanel/fieldNameValidation';
import type { FieldDef, FieldSource, FieldType, ID } from '../../types';
import { autoDir } from '../../../utils/textDirection';
import styles from './SchemaPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: ID;
  /** Existing field being edited; when null, the modal adds a new one. */
  initial: FieldDef | null;
  /** Seed the type dropdown when adding a new field. Used by the
   *  Dynamic Context flow to land on `enum` directly. Ignored when
   *  editing an existing field. Default `'string'`. */
  initialType?: FieldType;
}

/** Primitive types that appear at the top of the unified Type select.
 *  `enum` is intentionally NOT here — picking an enum means picking a
 *  SPECIFIC enum from the bible, surfaced as its own optgroup below. */
const PRIMITIVE_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
];

const SOURCES: FieldSource[] = ['explicit', 'inferred'];
const SOURCE_LABEL: Record<FieldSource, string> = {
  explicit: 'Explicit — only when the user literally says it',
  inferred: 'Inferred — can be concluded from conversation',
};

function newFieldId(): ID {
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}

export function SchemaFieldModal({ open, onClose, agentId, initial, initialType }: Props) {
  const { doc, updateAgent } = useBuilder();
  const { domainNames } = useAgentFields(agentId);
  // `removeField` lives on useCrewFields but only needs agent context —
  // safe to call with crewId='' for agent-scoped deletion.
  const { removeField } = useCrewFields(agentId, '');
  const confirm = useConfirm();
  const agent = doc.agents.find(a => a.id === agentId);

  const [name,         setName]         = useState('');
  // True when the user's last Name keystroke contained whitespace
  // that was silently stripped — drives the SPACE_BLOCKED_MESSAGE.
  const [nameSpaceBlocked, setNameSpaceBlocked] = useState(false);
  const [type,         setType]         = useState<FieldType>('string');
  const [source,       setSource]       = useState<FieldSource>('explicit');
  const [domain,       setDomain]       = useState('');
  const [howToExtract, setHowToExtract] = useState('');
  const [enumType,     setEnumType]     = useState<ID | ''>('');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setType(initial?.type ?? initialType ?? 'string');
    setSource(initial?.source ?? 'explicit');
    setDomain(initial?.domain ?? '');
    setHowToExtract(initial?.howToExtract ?? '');
    setEnumType((initial?.enumType ?? '') as ID | '');
  }, [open, initial, initialType]);

  const trimmedName = name.trim();
  const siblings = useMemo(() => {
    if (!agent) return [] as FieldDef[];
    const same = [...agent.fields];
    return same.filter(f => f.id !== initial?.id);
  }, [agent, initial]);
  const collides = trimmedName !== '' && siblings.some(f => f.name === trimmedName);
  // Shape check — surfaced as a non-blocking visual hint (red border
  // on the Name input + concise red helper line below). Save stays
  // enabled; collisions still block (silent overwrite is unrecoverable,
  // shape issues only break THIS field's extraction).
  const nameValidation = trimmedName.length > 0
    ? validateFieldName(trimmedName)
    : { ok: true, reason: '' };
  const canSave = trimmedName.length > 0 && !collides;

  // Count extractors currently wired to this field so the confirm
  // message can warn the user before deletion scrubs them.
  const wiredCount = useMemo(() => {
    if (!initial || !agent) return 0;
    let n = 0;
    for (const c of agent.crews) {
      for (const a of c.addons) {
        const list = (a.config as { extractsFields?: ID[] })?.extractsFields;
        if (Array.isArray(list) && list.includes(initial.id)) n += 1;
      }
    }
    return n;
  }, [initial, agent]);

  const handleDelete = async () => {
    if (!initial) return;
    const ok = await confirm({
      title: `Delete field "${initial.name}"?`,
      message: wiredCount > 0
        ? `Removes the declaration and scrubs it from ${wiredCount} extractor${wiredCount === 1 ? '' : 's'} that currently collect it.`
        : 'Removes the declaration. No extractors collect this field today, so nothing else is affected.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    removeField('agent', '', initial.id);
    onClose();
  };

  const handleSave = () => {
    if (!canSave || !agent) return;
    const nextField: FieldDef = {
      id:   initial?.id ?? newFieldId(),
      name: trimmedName,
      type,
      source,
      howToExtract: howToExtract.trim(),
      ...(domain.trim() ? { domain: domain.trim() } : {}),
      ...(type === 'enum' && enumType ? { enumType } : {}),
    };
    const existing = agent.fields.find(f => f.id === nextField.id);
    const fields = existing
      ? agent.fields.map(f => (f.id === nextField.id ? nextField : f))
      : [...agent.fields, nextField];
    updateAgent(agentId, { fields });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Edit field` : 'Declare field'}
      width={560}
      footer={
        <div className={styles.actions}>
          {initial && (
            <button type="button" className={styles.btnDanger} onClick={handleDelete}>
              Delete
            </button>
          )}
          <span className={styles.spacerInline} />
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={!canSave}
            onClick={handleSave}
          >
            {initial ? 'Save' : 'Declare'}
          </button>
        </div>
      }
    >
      <div className={styles.form}>
        <div>
          <div className={styles.label}>Name</div>
          <input
            className={`${styles.input} ${(!nameValidation.ok || nameSpaceBlocked) ? styles.inputInvalid : ''}`}
            value={name}
            onChange={e => {
              const raw = e.target.value;
              setNameSpaceBlocked(hadInvalidStripped(raw));
              setName(stripInvalid(raw));
            }}
            placeholder="e.g. employment_status"
            spellCheck={false}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter' && canSave) handleSave();
            }}
          />
          {collides && (
            <div className={styles.hint} style={{ color: '#b91c1c' }}>
              An agent field with this name already exists.
            </div>
          )}
          {/* Always rendered — fixed min-height reserves the slot so
              the form below doesn't jump when the message appears.
              Space-block message takes priority over the shape
              warning since it's immediate keystroke feedback.
              Suppress when collision is the active error. */}
          <div className={styles.nameWarning}>
            {collides
              ? ''
              : nameSpaceBlocked
                ? SPACE_BLOCKED_MESSAGE
                : !nameValidation.ok
                  ? nameValidation.reason
                  : ''}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className={styles.label}>Type</div>
            <select
              className={styles.input}
              // Encoded value: primitives use their plain name; enums
              // are "enum:<id>" so one change sets both type AND
              // enumType — no separate dropdown below.
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
              {type === 'enum'
                && enumType
                && !(agent?.enums ?? []).some(en => en.id === enumType)
                && (
                  <option value={`enum:${enumType}`}>(missing enum)</option>
                )}
            </select>
          </div>
          <div>
            <div className={styles.label}>Source</div>
            <select
              className={styles.input}
              value={source}
              onChange={e => setSource(e.target.value as FieldSource)}
            >
              {SOURCES.map(s => (
                <option key={s} value={s} title={SOURCE_LABEL[s]}>
                  {SOURCE_LABEL[s].split(' — ')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Enum picker preview — visible only when an enum is selected.
            Sits directly under the Type/Source row so the user
            immediately sees the value vocabulary they just bound.
            Same placement as in the Add field / Field editor modals.
            The unified Type dropdown above already wires both `type` and
            `enumType` in one go; this block is purely informative,
            plus a shortcut to edit the enum bible without losing context. */}
        {type === 'enum' && enumType && agent && (() => {
          const en = (agent.enums ?? []).find(e => e.id === enumType);
          if (!en) {
            return (
              <div className={styles.hint} style={{ color: '#b91c1c' }}>
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

        <div>
          <div className={styles.label}>Domain</div>
          <DomainInput
            value={domain}
            onChange={setDomain}
            options={domainNames}
          />
        </div>

        <div>
          <div className={styles.label}>How to extract</div>
          <textarea
            className={styles.textarea}
            value={howToExtract}
            onChange={e => setHowToExtract(e.target.value)}
            placeholder="What this field means. Used by extractors that collect it."
            spellCheck={false}
            dir={autoDir(howToExtract)}
          />
        </div>
        {type === 'enum' && !enumType && (agent?.enums ?? []).length === 0 && (
          <div className={styles.hint}>
            No enums declared yet. Open the Enums bible to author one.
          </div>
        )}

        <div className={styles.usageHint}>
          Declared fields are inert until a crew's extractor references them.
          Open the field in a crew view to wire it (the "Extracted by" multi-select).
        </div>
      </div>
    </Modal>
  );
}
