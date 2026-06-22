/**
 * SchemaFieldEditor — the inner editor form for a single field.
 *
 * Owns the per-field local state (name / type / source / domain /
 * definition / howToExtract / enumType), the validation surface,
 * and the save / delete handlers. The host (page) chrome lives
 * outside — this component just renders the form body and the
 * footer actions, accepting the host's `onAfterSave` / `onAfterDelete`
 * / `onCancel` callbacks so it stays UI-shell agnostic.
 *
 * Mounted today by the dedicated Fields page (`/builder/fields`);
 * the modal-based editing flow has been retired.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  agentId: ID;
  /** Existing field being edited; when null/undefined, renders the
   *  "declare new field" flow (no Delete button, primary action
   *  reads "Declare"). */
  initial: FieldDef | null;
  /** Seed the type dropdown for the "declare new" path. Ignored when
   *  `initial` is set. Default `'string'`. */
  initialType?: FieldType;
  /** Fires after a successful save with the persisted FieldDef. The
   *  host typically navigates / closes off this. */
  onAfterSave?: (saved: FieldDef) => void;
  /** Fires after a successful delete. */
  onAfterDelete?: () => void;
  /** Cancel — typically closes the host modal or navigates the host
   *  screen back to its list. */
  onCancel?: () => void;
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

export function SchemaFieldEditor({
  agentId, initial, initialType,
  onAfterSave, onAfterDelete, onCancel,
}: Props) {
  const { doc, updateAgent } = useBuilder();
  const { domainNames } = useAgentFields(agentId);
  // `removeField` lives on useCrewFields but only needs agent context —
  // safe to call with crewId='' for agent-scoped deletion.
  const { removeField } = useCrewFields(agentId, '');
  const confirm = useConfirm();
  const agent = doc.agents.find(a => a.id === agentId);

  const [name,         setName]         = useState('');
  const [nameSpaceBlocked, setNameSpaceBlocked] = useState(false);
  const [type,         setType]         = useState<FieldType>('string');
  const [source,       setSource]       = useState<FieldSource>('explicit');
  const [domain,       setDomain]       = useState('');
  const [howToExtract, setHowToExtract] = useState('');
  const [definition,   setDefinition]   = useState('');
  const [enumType,     setEnumType]     = useState<ID | ''>('');

  // Reseat local state whenever `initial` changes (e.g. user picks a
  // different field in the screen's left column). Distinct from the
  // modal's open/close lifecycle — we key off the actual field id so
  // switching between fields in the same screen mount works cleanly.
  useEffect(() => {
    setName(initial?.name ?? '');
    setNameSpaceBlocked(false);
    setType(initial?.type ?? initialType ?? 'string');
    setSource(initial?.source ?? 'explicit');
    setDomain(initial?.domain ?? '');
    setHowToExtract(initial?.howToExtract ?? '');
    setDefinition(initial?.definition ?? '');
    setEnumType((initial?.enumType ?? '') as ID | '');
  }, [initial?.id, initialType]);

  const trimmedName = name.trim();
  const siblings = useMemo(() => {
    if (!agent) return [] as FieldDef[];
    return agent.fields.filter(f => f.id !== initial?.id);
  }, [agent, initial?.id]);
  const collides = trimmedName !== '' && siblings.some(f => f.name === trimmedName);
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
    onAfterDelete?.();
  };

  const handleSave = () => {
    if (!canSave || !agent) return;
    const nextField: FieldDef = {
      id:   initial?.id ?? newFieldId(),
      name: trimmedName,
      type,
      source,
      howToExtract: howToExtract.trim(),
      ...(definition.trim() ? { definition: definition.trim() } : {}),
      ...(domain.trim() ? { domain: domain.trim() } : {}),
      ...(type === 'enum' && enumType ? { enumType } : {}),
    };
    const existing = agent.fields.find(f => f.id === nextField.id);
    const fields = existing
      ? agent.fields.map(f => (f.id === nextField.id ? nextField : f))
      : [...agent.fields, nextField];
    updateAgent(agentId, { fields });
    onAfterSave?.(nextField);
  };

  return (
    <>
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
          <div className={styles.label}>
            Definition <span style={{
              textTransform: 'none',
              letterSpacing: 0,
              fontWeight: 500,
              fontStyle: 'italic',
              opacity: 0.75,
            }}>· for you, never sent to the LLM</span>
          </div>
          <textarea
            className={styles.textarea}
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            placeholder="Your own note about what this field means. Builder-only — the runtime never reads it."
            spellCheck={false}
            dir={autoDir(definition)}
            rows={2}
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

      {/* Footer actions live INSIDE the editor — the host wraps this
          component, doesn't need to know how the editor saves. The
          Modal-host renders the same footer; the screen-host renders
          them inline. */}
      <div className={styles.actions} style={{ marginTop: 12 }}>
        {initial && (
          <button type="button" className={styles.btnDanger} onClick={handleDelete}>
            Delete
          </button>
        )}
        <span className={styles.spacerInline} />
        {onCancel && (
          <button type="button" className={styles.btnGhost} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={!canSave}
          onClick={handleSave}
        >
          {initial ? 'Save' : 'Declare'}
        </button>
      </div>
    </>
  );
}
