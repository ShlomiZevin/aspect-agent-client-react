/**
 * TransitionRouterConfig — config UI for the Transition Router.
 *
 * UX shape:
 *   - Target crew: chip selector.
 *   - Conditions:  ordered compact cards. Type pill, then inline
 *                  fields, then × on the right.
 *   - Reason:      small text input.
 *   - After match: horizontal pill toggle (Continue / Break).
 *
 * The `field` condition type is op-driven. The operator dropdown
 * filters based on the chosen field's declared type — enums get
 * equality/membership ops, strings add substring ops, ints get
 * comparison ops, booleans only get equality.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PluginConfigProps } from '../../registry/plugins';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewFields } from '../../state/useCrewFields';
import type { FieldDef, FieldOp, TransitionCondition, TransitionRouterConfig } from '../../types';
import styles from './TransitionRouterConfig.module.css';

type CondType = TransitionCondition['type'];

const CONDITION_TYPES: { value: CondType; label: string }[] = [
  { value: 'field',            label: 'Field check' },
  { value: 'fields-collected', label: 'Fields collected' },
];

const OP_LABELS: Record<FieldOp, string> = {
  'equals':       '=',
  'not-equals':   '≠',
  'contains':     'contains',
  'starts-with':  'starts with',
  'ends-with':    'ends with',
  'gt':           '>',
  'gte':          '≥',
  'lt':           '<',
  'lte':          '≤',
  'in':           'is one of',
  'not-in':       'is not one of',
};

/** Operators allowed for a given field. Used to filter the op
 *  dropdown so e.g. you can't pick `contains` on an integer field. */
function opsForField(field?: FieldDef): FieldOp[] {
  if (!field) return ['equals', 'not-equals', 'in', 'not-in'];
  switch (field.type) {
    case 'enum':
      return ['equals', 'not-equals', 'in', 'not-in'];
    case 'string':
      return ['equals', 'not-equals', 'contains', 'starts-with', 'ends-with', 'in', 'not-in'];
    case 'int':
      return ['equals', 'not-equals', 'gt', 'gte', 'lt', 'lte'];
    case 'boolean':
      return ['equals', 'not-equals'];
    default:
      return ['equals', 'not-equals'];
  }
}

function isMultiValueOp(op: FieldOp): boolean {
  return op === 'in' || op === 'not-in';
}

function emptyCondition(type: CondType): TransitionCondition {
  switch (type) {
    case 'fields-collected':
      return { type, fields: [] };
    case 'field':
      return { type, field: '', op: 'equals', value: '' };
  }
}

export function TransitionRouterConfigComponent({
  config, onChange, agentId, crewId,
}: PluginConfigProps<TransitionRouterConfig>) {
  const { doc } = useBuilder();
  const { allFields } = useCrewFields(agentId, crewId);

  const targets = useMemo(() => {
    const agent = doc.agents.find(a => a.id === agentId);
    if (!agent) return [];
    return agent.crews.filter(c => c.id !== crewId).map(c => ({ id: c.id, name: c.name }));
  }, [doc, agentId, crewId]);

  const fieldByName = useMemo(() => {
    const map = new Map<string, FieldDef>();
    for (const cf of allFields) {
      if (cf.field.name) map.set(cf.field.name, cf.field);
    }
    return map;
  }, [allFields]);

  const fieldNames = useMemo(
    () => Array.from(fieldByName.keys()).sort(),
    [fieldByName],
  );

  const updateCondition = (i: number, next: TransitionCondition) => {
    const conditions = [...config.conditions];
    conditions[i] = next;
    onChange({ ...config, conditions });
  };
  const removeCondition = (i: number) => {
    onChange({ ...config, conditions: config.conditions.filter((_, k) => k !== i) });
  };
  const addCondition = () => {
    onChange({ ...config, conditions: [...config.conditions, emptyCondition('field')] });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.rowLabel}>Target</span>
        {targets.length === 0 ? (
          <span className={styles.empty}>Add a second crew first.</span>
        ) : (
          <div className={styles.chipGroup}>
            {targets.map(t => (
              <button
                key={t.id}
                type="button"
                className={`${styles.chip} ${config.target === t.id ? styles.chipActive : ''}`}
                onClick={() => onChange({ ...config, target: t.id })}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            Conditions <span className={styles.sectionSub}>· all must match</span>
          </span>
          <button type="button" className={styles.addBtn} onClick={addCondition}>
            + Add
          </button>
        </div>
        {config.conditions.length === 0 ? (
          <div className={styles.condEmpty}>
            No conditions — router will never fire. Add one above.
          </div>
        ) : (
          <div className={styles.condList}>
            {config.conditions.map((cond, i) => (
              <ConditionCard
                key={i}
                cond={cond}
                fieldNames={fieldNames}
                fieldByName={fieldByName}
                onChange={next => updateCondition(i, next)}
                onRemove={() => removeCondition(i)}
              />
            ))}
          </div>
        )}
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>Reason</span>
        <input
          className={styles.reasonInput}
          value={config.reason ?? ''}
          onChange={e => onChange({ ...config, reason: e.target.value })}
          placeholder="optional — shown in the addon timeline"
          spellCheck={false}
        />
      </div>

      <div className={styles.row}>
        <span className={styles.rowLabel}>After match</span>
        <div className={styles.toggleGroup}>
          <button
            type="button"
            className={`${styles.toggle} ${config.onMatch !== 'break' ? styles.toggleActive : ''}`}
            onClick={() => onChange({ ...config, onMatch: 'continue' })}
            title="Run the rest of this turn's chain. Talker (if downstream) still speaks."
          >
            Continue
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${config.onMatch === 'break' ? styles.toggleActive : ''}`}
            onClick={() => onChange({ ...config, onMatch: 'break' })}
            title="Skip the rest of this turn. No assistant response this turn."
          >
            Break
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Condition card ───────────────────────────────────────────── */

interface ConditionCardProps {
  cond: TransitionCondition;
  fieldNames: string[];
  fieldByName: Map<string, FieldDef>;
  onChange: (next: TransitionCondition) => void;
  onRemove: () => void;
}

function ConditionCard({
  cond, fieldNames, fieldByName, onChange, onRemove,
}: ConditionCardProps) {
  const setType = (type: CondType) => onChange(emptyCondition(type));

  return (
    <div className={styles.condCard}>
      <select
        className={styles.condTypePill}
        value={cond.type}
        onChange={e => setType(e.target.value as CondType)}
      >
        {CONDITION_TYPES.map(t => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      <div className={styles.condBody}>
        {cond.type === 'field' && (
          <FieldBody cond={cond} fieldNames={fieldNames} fieldByName={fieldByName} onChange={onChange} />
        )}
        {cond.type === 'fields-collected' && (
          <FieldsCollectedBody cond={cond} fieldNames={fieldNames} onChange={onChange} />
        )}
      </div>

      <button
        type="button"
        className={styles.condRemove}
        onClick={onRemove}
        title="Remove condition"
        aria-label="Remove condition"
      >
        ✕
      </button>
    </div>
  );
}

/* ─── Bodies ───────────────────────────────────────────────────── */

function FieldBody({
  cond, fieldNames, fieldByName, onChange,
}: {
  cond: Extract<TransitionCondition, { type: 'field' }>;
  fieldNames: string[];
  fieldByName: Map<string, FieldDef>;
  onChange: (next: TransitionCondition) => void;
}) {
  const matched = fieldByName.get(cond.field);
  const allowedOps = opsForField(matched);
  // If the user switched to a field whose type doesn't allow the
  // currently-selected op, snap to `equals` (always valid).
  useEffect(() => {
    if (!allowedOps.includes(cond.op)) {
      onChange({ ...cond, op: 'equals', value: '', values: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cond.field, allowedOps.join(',')]);

  const isEnum = matched?.type === 'enum'
    && Array.isArray(matched.enumValues)
    && matched.enumValues.length > 0;
  const isBoolean = matched?.type === 'boolean';
  const isNumeric = matched?.type === 'int';
  const multiValue = isMultiValueOp(cond.op);

  return (
    <>
      <ComboPicker
        value={cond.field}
        options={fieldNames}
        // Changing the field clears the value(s) — a value valid for
        // one field's type is rarely valid for another (an int range
        // makes no sense once you switch to a boolean field, etc.).
        onChange={v => onChange({ ...cond, field: v, value: '', values: [] })}
        placeholder="field name"
      />
      <select
        className={styles.opSelect}
        value={cond.op}
        onChange={e => {
          const nextOp = e.target.value as FieldOp;
          // Switching binary↔multi resets the now-irrelevant slot
          // so we don't carry stale state around.
          const next = isMultiValueOp(nextOp)
            ? { ...cond, op: nextOp, values: cond.values ?? [], value: undefined }
            : { ...cond, op: nextOp, value: cond.value ?? '', values: undefined };
          onChange(next);
        }}
      >
        {allowedOps.map(op => (
          <option key={op} value={op}>{OP_LABELS[op]}</option>
        ))}
      </select>

      {multiValue ? (
        isEnum ? (
          <MultiChipPicker
            options={(matched!.enumValues ?? []).map(String)}
            values={(cond.values ?? []).map(String)}
            onChange={values => onChange({ ...cond, values })}
          />
        ) : (
          <input
            className={styles.inlineInput}
            value={(cond.values ?? []).map(v => String(v)).join(', ')}
            onChange={e => onChange({
              ...cond,
              values: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
            })}
            placeholder="value1, value2"
            spellCheck={false}
          />
        )
      ) : isEnum ? (
        <ComboPicker
          value={String(cond.value ?? '')}
          options={(matched!.enumValues ?? []).map(String)}
          onChange={v => onChange({ ...cond, value: v })}
          placeholder="pick value"
          allowFreeText={false}
        />
      ) : isBoolean ? (
        <ComboPicker
          value={String(cond.value ?? '')}
          options={['true', 'false']}
          onChange={v => onChange({ ...cond, value: v })}
          placeholder="true / false"
          allowFreeText={false}
        />
      ) : (
        <input
          className={styles.inlineInput}
          type={isNumeric ? 'number' : 'text'}
          value={String(cond.value ?? '')}
          onChange={e => onChange({ ...cond, value: e.target.value })}
          placeholder="value"
          spellCheck={false}
        />
      )}
    </>
  );
}

function FieldsCollectedBody({
  cond, fieldNames, onChange,
}: {
  cond: Extract<TransitionCondition, { type: 'fields-collected' }>;
  fieldNames: string[];
  onChange: (next: TransitionCondition) => void;
}) {
  const valueSet = useMemo(() => new Set(cond.fields), [cond.fields]);
  const toggle = (name: string) => {
    const next = new Set(valueSet);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange({ ...cond, fields: Array.from(next) });
  };

  if (fieldNames.length > 0) {
    return (
      <div className={styles.miniChipGroup}>
        {fieldNames.map(n => {
          const active = valueSet.has(n);
          return (
            <button
              key={n}
              type="button"
              className={`${styles.miniChip} ${active ? styles.miniChipActive : ''}`}
              onClick={() => toggle(n)}
            >
              {n}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <input
      className={styles.inlineInput}
      value={cond.fields.join(', ')}
      onChange={e => onChange({
        ...cond,
        fields: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
      })}
      placeholder="field names, comma-separated"
      spellCheck={false}
    />
  );
}

/* ─── Reusable: chip multi-picker for in / not-in over enum ─────── */

function MultiChipPicker({
  options, values, onChange,
}: {
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const set = useMemo(() => new Set(values), [values]);
  const toggle = (v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(Array.from(next));
  };
  return (
    <div className={styles.miniChipGroup}>
      {options.map(o => {
        const active = set.has(o);
        return (
          <button
            key={o}
            type="button"
            className={`${styles.miniChip} ${active ? styles.miniChipActive : ''}`}
            onClick={() => toggle(o)}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ─── ComboPicker ──────────────────────────────────────────────── */

interface ComboPickerProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  /** When false, user can only pick from `options` (no typing). */
  allowFreeText?: boolean;
}

function ComboPicker({
  value, options, onChange, placeholder, allowFreeText = true,
}: ComboPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (allowFreeText && draft !== value) onChange(draft);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, allowFreeText, draft, value, onChange]);

  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, draft]);

  const pick = (v: string) => {
    setDraft(v);
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={styles.combo} ref={ref}>
      <input
        className={styles.comboInput}
        value={draft}
        readOnly={!allowFreeText}
        onChange={e => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && allowFreeText) {
            onChange(draft);
            setOpen(false);
          } else if (e.key === 'Escape') {
            setDraft(value);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      {/* Caret only when the picker is options-only (enum / bool).
        * Free-text combos (field name) get autocomplete via focus +
        * typing and don't need a chevron implying a closed menu. */}
      {!allowFreeText && (
        <button
          type="button"
          className={`${styles.comboCaret} ${open ? styles.comboCaretOpen : ''}`}
          onClick={() => setOpen(o => !o)}
          tabIndex={-1}
          aria-label="Toggle options"
        >
          ▾
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className={styles.comboMenu} role="listbox">
          {filtered.map(o => (
            <button
              key={o}
              type="button"
              role="option"
              aria-selected={o === value}
              className={`${styles.comboItem} ${o === value ? styles.comboItemActive : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(o)}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
