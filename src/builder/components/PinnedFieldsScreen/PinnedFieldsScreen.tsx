/**
 * PinnedFieldsScreen — focused page for `source: 'pinned'` fields.
 *
 * A pinned field IS a regular FieldDef (lives in `agent.fields[]`)
 * with `source: 'pinned'` + a `defaultValue` chosen from a Targeted KB.
 * The runtime seeds memory[domain][name] with `defaultValue` at every
 * turn when the slot is empty; conversation-level overrides win.
 *
 * This page is a focused surface: one row per pin, an inline value
 * picker for the swap, a `+ Add pin` wizard to create new pins, and
 * a link out to the regular Fields page for advanced editing.
 * Everything is also achievable via the Fields page; this is the
 * "I'm thinking in pins" entry point.
 *
 *   URL routing
 *     /<agent>/builder/pinned
 *
 * Cascades reuse the existing field rename / delete plumbing — pins
 * are fields all the way down.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewFields } from '../../state/useCrewFields';
import { useConfirm } from '../Confirm/Confirm';
import type { EnumTypeDef, FieldDef, ID } from '../../types';

/** Same shape the rest of the builder uses for identifier validation
 *  (Parameter / Snippet inline copies). Centralising it here too is
 *  cheap; we can hoist to a shared helper later if more callers need it. */
function isValidName(s: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(s);
}
import styles from './PinnedFieldsScreen.module.css';

function newFieldId(): ID {
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}

/** Sanitise a typed pin name to the same shape field names use:
 *  lowercased, trimmed, spaces → underscores. Keeps the autocomplete
 *  / token semantics consistent (the pin is reachable as `{{field:N}}`). */
function sanitisePinName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

export function PinnedFieldsScreen() {
  const navigate = useNavigate();
  const { doc, updateAgent } = useBuilder();
  const confirm = useConfirm();
  const agent = doc.agents[0];
  const agentSlug = agent?.slug ?? '';
  // Reuse the crew-fields helper for `removeField` — pinned-only
  // editing still needs the same removal cascade Fields uses. crewId=''
  // because we only touch agent-scoped pins here.
  const { removeField } = useCrewFields(agent?.id ?? '', '');

  // Pinned fields = every FieldDef on the agent whose source is 'pinned'.
  // Walk agent.fields only (per spec: crew-scoped pinned fields are
  // possible but a v1 non-goal — they'd still render here if added).
  const pinnedFields = useMemo<FieldDef[]>(() => {
    const out: FieldDef[] = [];
    for (const f of agent?.fields ?? []) {
      if (f.source === 'pinned') out.push(f);
    }
    return out;
  }, [agent?.fields]);

  const enumsById = useMemo<Map<string, EnumTypeDef>>(() => {
    const map = new Map<string, EnumTypeDef>();
    for (const e of agent?.enums ?? []) map.set(e.id, e);
    return map;
  }, [agent?.enums]);

  const [wizardOpen, setWizardOpen] = useState(false);

  const commitDefaultValue = useCallback((field: FieldDef, next: string) => {
    if (!agent) return;
    if (next === (field.defaultValue ?? '')) return;
    const fields = agent.fields.map(f =>
      f.id === field.id
        ? { ...f, defaultValue: next || undefined }
        : f,
    );
    updateAgent(agent.id, { fields });
  }, [agent, updateAgent]);

  const handleDelete = useCallback(async (field: FieldDef) => {
    const ok = await confirm({
      title:        `Delete pin "${field.name}"?`,
      message:      `Removes this pin's FieldDef. Any prompt using {{field:${field.name}}} or {{dc:${field.name}:...}} will resolve to empty.`,
      confirmLabel: 'Delete',
      danger:       true,
    });
    if (!ok) return;
    removeField('agent', '', field.id);
  }, [confirm, removeField]);

  if (!agent) {
    return <div className={styles.empty}>Loading agent…</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.crumbs}>
          <span className={`${styles.crumb} ${styles.crumbCurrent}`}>Pinned Fields</span>
        </div>
        <div className={styles.hint}>
          Each pin is a Targeted KB whose value is set at agent-config time
          instead of collected from the conversation. The runtime seeds
          memory at turn start; chat-level overrides win.
        </div>
      </div>

      <div className={styles.list}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() => setWizardOpen(true)}
        >
          + Add pin
        </button>

        {pinnedFields.length === 0 ? (
          <div className={styles.listEmpty}>
            No pinned fields yet. Click <strong>+ Add pin</strong> to point
            this agent at one Targeted KB value.
          </div>
        ) : (
          <ul className={styles.rows}>
            {pinnedFields.map(f => {
              const kb = f.enumType ? enumsById.get(f.enumType) ?? null : null;
              const kbValues = (kb?.values ?? [])
                .map(v => v?.value)
                .filter((v): v is string => typeof v === 'string' && v.length > 0);
              const missingKb = !!f.enumType && !kb;
              return (
                <li key={f.id} className={styles.row}>
                  <span className={styles.rowIcon}>🎯</span>
                  <div className={styles.rowName}>
                    <Link
                      to={`/${agentSlug}/builder/fields/${encodeURIComponent(f.name)}`}
                      className={styles.rowNameLink}
                      title="Open in the Fields editor"
                    >
                      {f.name}
                    </Link>
                    <span className={styles.rowKb}>
                      {missingKb
                        ? <em style={{ color: '#b91c1c' }}>missing KB</em>
                        : kb
                          ? <>Targeted KB · {kb.name}</>
                          : <em>no KB bound</em>}
                    </span>
                  </div>
                  {kbValues.length > 0 ? (
                    <select
                      className={styles.valueSelect}
                      value={f.defaultValue ?? ''}
                      onChange={e => commitDefaultValue(f, e.target.value)}
                    >
                      {!f.defaultValue && <option value="">— pick —</option>}
                      {kbValues.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                      {f.defaultValue && !kbValues.includes(f.defaultValue) && (
                        <option value={f.defaultValue}>
                          {f.defaultValue} (no longer on KB)
                        </option>
                      )}
                    </select>
                  ) : (
                    <span className={styles.valueMissing}>
                      KB has no values
                    </span>
                  )}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleDelete(f)}
                    title="Delete this pin"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {wizardOpen && (
        <AddPinWizard
          agentId={agent.id}
          enums={agent.enums ?? []}
          existingFieldNames={(agent.fields ?? []).map(f => f.name)}
          onCancel={() => setWizardOpen(false)}
          onCreate={pin => {
            const fields = [...(agent.fields ?? []), pin];
            updateAgent(agent.id, { fields });
            setWizardOpen(false);
            navigate(`/${agentSlug}/builder/pinned`);
          }}
        />
      )}
    </div>
  );
}

/* ─── Add-pin wizard ──────────────────────────────────────────────── */

interface WizardProps {
  agentId: ID;
  enums: EnumTypeDef[];
  existingFieldNames: string[];
  onCancel: () => void;
  onCreate: (pin: FieldDef) => void;
}

/** Pick a unique pin name based on a base slug (the KB's name).
 *  Mirrors the new_field uniquifier used elsewhere so the conflict
 *  flow is consistent across the builder. */
function uniqueName(base: string, taken: ReadonlyArray<string>): string {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

function AddPinWizard({ enums, existingFieldNames, onCancel, onCreate }: WizardProps) {
  const [enumId, setEnumId] = useState<ID | ''>('');
  const en = useMemo(() => enums.find(e => e.id === enumId) ?? null, [enums, enumId]);
  // KB-name slug as the default field name. Auto-uniquified against
  // existing field names — that's how multi-pin-per-KB scenarios get
  // a sensible starting name ("cards" → "cards_2" if cards is taken).
  const defaultName = useMemo(
    () => en ? uniqueName(sanitisePinName(en.name), existingFieldNames) : '',
    [en, existingFieldNames],
  );
  const [name, setName] = useState('');
  const [defaultValue, setDefaultValue] = useState('');

  // Reset name + value whenever the KB choice changes so the form
  // never lands in a stale state (e.g. name from one KB, value from
  // another). useEffect avoided — direct derivation is cleaner here.
  if (name === '' && defaultName !== '') {
    // Lazy-prefill: only when the user hasn't typed anything yet, so
    // editing isn't clobbered every render.
    setName(defaultName);
  }

  const valueOptions = (en?.values ?? [])
    .map(v => v?.value)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  const trimmedName = sanitisePinName(name);
  const nameValid = isValidName(trimmedName);
  const nameTaken = existingFieldNames.includes(trimmedName);
  const canCreate =
    !!en &&
    trimmedName !== '' &&
    nameValid &&
    !nameTaken &&
    !!defaultValue;

  const handleCreate = () => {
    if (!canCreate || !en) return;
    const pin: FieldDef = {
      id:           newFieldId(),
      name:         trimmedName,
      type:         'enum',
      source:       'pinned',
      howToExtract: '',
      enumType:     en.id,
      defaultValue,
    };
    onCreate(pin);
  };

  return (
    <div className={styles.wizardOverlay} onClick={onCancel}>
      <div className={styles.wizardCard} onClick={e => e.stopPropagation()}>
        <div className={styles.wizardHeader}>
          <span className={styles.wizardTitle}>🎯 New pinned field</span>
          <button type="button" className={styles.wizardClose} onClick={onCancel}>×</button>
        </div>

        <div className={styles.wizardBody}>
          <div className={styles.wizardStep}>
            <div className={styles.wizardLabel}>Targeted KB</div>
            <select
              className={styles.input}
              value={enumId}
              onChange={e => {
                setEnumId(e.target.value as ID);
                // KB changed → re-prefill defaults from the new KB.
                setName('');
                setDefaultValue('');
              }}
            >
              <option value="">— pick a KB —</option>
              {enums.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            {enums.length === 0 && (
              <div className={styles.wizardWarn}>
                No Targeted KBs declared yet. Go to the Targeted KB editor
                to author one first.
              </div>
            )}
          </div>

          <div className={styles.wizardStep}>
            <div className={styles.wizardLabel}>Pin name</div>
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={defaultName || 'pin_name'}
              spellCheck={false}
              disabled={!en}
            />
            {trimmedName && !nameValid && (
              <div className={styles.wizardWarn}>
                Name must be lowercase letters / digits / underscores.
              </div>
            )}
            {trimmedName && nameTaken && (
              <div className={styles.wizardWarn}>
                A field named "{trimmedName}" already exists. Pick another.
              </div>
            )}
            <div className={styles.wizardSub}>
              Used as <code>{`{{field:${trimmedName || 'NAME'}}}`}</code>
              {' '}and <code>{`{{dc:${trimmedName || 'NAME'}:SEC}}`}</code> in any prompt.
            </div>
          </div>

          <div className={styles.wizardStep}>
            <div className={styles.wizardLabel}>Default value</div>
            {!en ? (
              <div className={styles.wizardSub}>Pick a KB above first.</div>
            ) : valueOptions.length === 0 ? (
              <div className={styles.wizardWarn}>
                "{en.name}" has no values declared yet — add some on the KB editor
                to pin a default.
              </div>
            ) : (
              <select
                className={styles.input}
                value={defaultValue}
                onChange={e => setDefaultValue(e.target.value)}
              >
                <option value="">— pick a value —</option>
                {valueOptions.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className={styles.wizardFooter}>
          <button type="button" className={styles.wizardCancel} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.wizardCreate}
            onClick={handleCreate}
            disabled={!canCreate}
          >
            Create pin
          </button>
        </div>
      </div>
    </div>
  );
}
