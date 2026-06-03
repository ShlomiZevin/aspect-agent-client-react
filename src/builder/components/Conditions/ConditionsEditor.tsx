/**
 * ConditionsEditor — shared compact UI for a list of TransitionCondition.
 *
 * Used by the Transition Router. (Was previously shared with
 * Triggered Context before Dynamic Context replaced it.)
 * One condition vocabulary, one editor. The host plugin keeps its own
 * outer layout (target / reason / writes-to / etc.) and embeds this
 * component for the condition rows.
 *
 * The `field` condition type is op-driven. The operator dropdown
 * filters based on the chosen field's declared type — enums get
 * equality/membership ops, strings add substring ops, ints get
 * comparison ops, booleans only get equality.
 */

import { useEffect, useMemo } from 'react';
import { useCrewFields } from '../../state/useCrewFields';
import { ComboPicker } from './ComboPicker';
import type { FieldDef, FieldOp, ID, TransitionCondition } from '../../types';
import styles from './ConditionsEditor.module.css';

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

interface ConditionsEditorProps {
  conditions: TransitionCondition[];
  onChange: (next: TransitionCondition[]) => void;
  agentId: ID;
  crewId: ID;
  /** Header shown above the list. Defaults to "Conditions · all must match". */
  title?: string;
  /** Message shown when the list is empty. */
  emptyMessage?: string;
}

export function ConditionsEditor({
  conditions, onChange, agentId, crewId,
  title = 'Conditions',
  emptyMessage = 'No conditions — this rule will never fire. Add one above.',
}: ConditionsEditorProps) {
  const { allFields } = useCrewFields(agentId, crewId);

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
    const out = [...conditions];
    out[i] = next;
    onChange(out);
  };
  const removeCondition = (i: number) => {
    onChange(conditions.filter((_, k) => k !== i));
  };
  const addCondition = () => {
    onChange([...conditions, emptyCondition('field')]);
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionTitle}>
          {title} <span className={styles.sectionSub}>· all must match</span>
        </span>
        <button type="button" className={styles.addBtn} onClick={addCondition}>
          + Add
        </button>
      </div>
      {conditions.length === 0 ? (
        <div className={styles.condEmpty}>{emptyMessage}</div>
      ) : (
        <div className={styles.condList}>
          {conditions.map((cond, i) => (
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
        onChange={v => onChange({ ...cond, field: v, value: '', values: [] })}
        placeholder="field name"
      />
      <select
        className={styles.opSelect}
        value={cond.op}
        onChange={e => {
          const nextOp = e.target.value as FieldOp;
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

