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

const TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',  label: 'String' },
  { value: 'int',     label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'enum',    label: 'Enum' },
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
            className={styles.input}
            value={name}
            onChange={e => setName(e.target.value)}
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
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div className={styles.label}>Type</div>
            <select
              className={styles.input}
              value={type}
              onChange={e => setType(e.target.value as FieldType)}
            >
              {TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
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

        {type === 'enum' && (
          <div>
            <div className={styles.label}>Enum type</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                className={styles.input}
                value={enumType}
                onChange={e => setEnumType(e.target.value as ID | '')}
                style={{ flex: 1 }}
              >
                <option value="">(none — pick an enum)</option>
                {(agent?.enums ?? []).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              {enumType && agent && (
                <Link
                  to={`/${agent.slug}/builder/enums/${encodeURIComponent(
                    (agent.enums ?? []).find(e => e.id === enumType)?.name ?? ''
                  )}`}
                  onClick={onClose}
                  style={{
                    fontSize: 11, fontWeight: 700, padding: '6px 10px',
                    border: '1px solid #e5e7eb', borderRadius: 6,
                    background: '#fff', color: '#2563eb', textDecoration: 'none',
                  }}
                >
                  Edit enum ↗
                </Link>
              )}
            </div>
            <div className={styles.hint} style={{ marginTop: 4 }}>
              {(agent?.enums ?? []).length === 0
                ? 'No enums declared yet. Open the Enums bible from the Setup area to author one.'
                : 'Pick the value vocabulary this field draws from. Multiple fields can share an enum.'}
            </div>
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
