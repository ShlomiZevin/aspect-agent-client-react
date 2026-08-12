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

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBuilder } from '../../state/BuilderContext';
import { useCrewFields } from '../../state/useCrewFields';
import { ComboPicker } from './ComboPicker';
import { lintFormula } from './formulaLint';
import { FormulaHelpButton } from './FormulaHelp';
import { MentionTextarea } from '../MentionTextarea/MentionTextarea';
import { SYSTEM_FIELDS } from '../../registry/systemFields';
import type { FieldDef, FieldOp, ID, TransitionCondition } from '../../types';
import styles from './ConditionsEditor.module.css';

type CondType = TransitionCondition['type'];

/**
 * NOTE on `run-count`: the type stays in the `TransitionCondition`
 * union (server still evaluates it; it remains useful for transition
 * routers as "this router has fired ≤ N times"), but it is NOT
 * surfaced in this picker any more. The per-addon "cap how many
 * times this runs" gate moved to its own field on `AddonFilter.cap`
 * — see AddonFilterSection. Mixing a cap inside the same dropdown
 * as field-conditions made the polarity toggle (Run when / Skip
 * when) ambiguous to authors.
 */
const CONDITION_TYPES: { value: CondType; label: string }[] = [
  { value: 'field',            label: 'Field check' },
  { value: 'fields-collected', label: 'Fields collected' },
  { value: 'formula',          label: 'Formula' },
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
    case 'formula':
      return { type, expr: '' };
    case 'run-count':
      // Defensive — `run-count` isn't picked from the dropdown any
      // more, but if it ever arrives here (legacy data, programmatic
      // call), give it a sane shape. The per-addon `cap` field
      // on AddonFilter is the actual UX surface today.
      return { type, max: 1 };
  }
}

interface ConditionsEditorProps {
  conditions: TransitionCondition[];
  onChange: (next: TransitionCondition[]) => void;
  agentId: ID;
  crewId: ID;
  /** Header shown above the list. Defaults to "Conditions · all must match".
   *  Accepts a node so hosts can inline their own label pill (Rules
   *  passes its WHEN pill here to keep everything on one line). */
  title?: ReactNode;
  /** Message shown when the list is empty. */
  emptyMessage?: string;
  /** Optional content slotted between the title and the +Add button.
   *  FilterEditor uses this to put its polarity toggle on the same
   *  row instead of stacking it above — saves a row of vertical
   *  real estate. */
  headerSlot?: ReactNode;
  /** Render condition rows without the white card chrome (background/
   *  border). For hosts that already wrap the editor in their own
   *  panel — the Rules addon's WHEN zone. Default false: every other
   *  host keeps the card look. */
  flat?: boolean;
}

export function ConditionsEditor({
  conditions, onChange, agentId, crewId,
  title = 'Conditions',
  emptyMessage = 'No conditions — this rule will never fire. Add one above.',
  headerSlot,
  flat = false,
}: ConditionsEditorProps) {
  const { allFields } = useCrewFields(agentId, crewId);
  const { doc } = useBuilder();
  const agent = doc.agents.find(a => a.id === agentId);

  /** For an enum-typed field, look up its declared values via the
   *  agent's enum bible. Returns [] when the field isn't enum-typed
   *  or its enumType doesn't resolve. */
  const enumValuesFor = useMemo(() => {
    return (field: FieldDef | undefined): string[] => {
      if (!field || field.type !== 'enum' || !field.enumType) return [];
      const enumDef = (agent?.enums ?? []).find(e => e.id === field.enumType);
      if (!enumDef) return [];
      return enumDef.values.map(v => v.value).filter(Boolean);
    };
  }, [agent?.enums]);

  const fieldByName = useMemo(() => {
    const map = new Map<string, FieldDef>();
    for (const cf of allFields) {
      if (cf.field.name) map.set(cf.field.name, cf.field);
    }
    // System fields appear in the same pool — they evaluate as
    // regular fields at the server (`findFieldValue` walks every
    // memory bucket regardless of domain). The synthetic `FieldDef`
    // here is enough for the editor's type-aware widgets to render
    // (e.g. boolean → true/false picker).
    for (const sys of SYSTEM_FIELDS) {
      if (map.has(sys.name)) continue; // shouldn't happen — names are reserved
      map.set(sys.name, {
        id:           `__system_${sys.name}`,
        name:         sys.name,
        type:         sys.type,
        source:       'inferred',
        howToExtract: sys.description,
      });
    }
    return map;
  }, [allFields]);

  const fieldNames = useMemo(
    () => Array.from(fieldByName.keys()).sort(),
    [fieldByName],
  );

  /** Set of names that are platform-defined system fields. Threaded
   *  into the field-name ComboPicker so it can render a SYS badge
   *  on those rows. */
  const systemFieldNames = useMemo(
    () => new Set(SYSTEM_FIELDS.map(s => s.name)),
    [],
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
        {title && (
          <span className={styles.sectionTitle}>
            {title} <span className={styles.sectionSub}>· all must match</span>
          </span>
        )}
        {/* Caller-supplied content (FilterEditor passes its polarity
            toggle here so it shares the row instead of stacking). */}
        {headerSlot && <span className={styles.sectionSlot}>{headerSlot}</span>}
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
              enumValuesFor={enumValuesFor}
              systemFieldNames={systemFieldNames}
              flat={flat}
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
  enumValuesFor: (field: FieldDef | undefined) => string[];
  systemFieldNames: Set<string>;
  flat?: boolean;
  onChange: (next: TransitionCondition) => void;
  onRemove: () => void;
}

function ConditionCard({
  cond, fieldNames, fieldByName, enumValuesFor, systemFieldNames, flat, onChange, onRemove,
}: ConditionCardProps) {
  const setType = (type: CondType) => onChange(emptyCondition(type));

  return (
    <div className={`${styles.condCard} ${flat ? styles.condCardFlat : ''}`}>
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
          <FieldBody cond={cond} fieldNames={fieldNames} fieldByName={fieldByName} enumValuesFor={enumValuesFor} systemFieldNames={systemFieldNames} onChange={onChange} />
        )}
        {cond.type === 'fields-collected' && (
          <FieldsCollectedBody cond={cond} fieldNames={fieldNames} systemFieldNames={systemFieldNames} onChange={onChange} />
        )}
        {cond.type === 'formula' && (
          <FormulaBody cond={cond} fieldNames={fieldNames} onChange={onChange} />
        )}
        {/* `run-count` body is no longer surfaced here — see the cap
            input on AddonFilterSection. The type stays in the union
            so legacy data + transition-router use keep evaluating. */}
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
  cond, fieldNames, fieldByName, enumValuesFor, systemFieldNames, onChange,
}: {
  cond: Extract<TransitionCondition, { type: 'field' }>;
  fieldNames: string[];
  fieldByName: Map<string, FieldDef>;
  enumValuesFor: (field: FieldDef | undefined) => string[];
  systemFieldNames: Set<string>;
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

  const enumValues = enumValuesFor(matched);
  const isEnum = matched?.type === 'enum' && enumValues.length > 0;
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
        systemNames={systemFieldNames}
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
            options={enumValues}
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
          options={enumValues}
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
  cond, fieldNames, systemFieldNames, onChange,
}: {
  cond: Extract<TransitionCondition, { type: 'fields-collected' }>;
  fieldNames: string[];
  systemFieldNames: Set<string>;
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
          const isSystem = systemFieldNames.has(n);
          return (
            <button
              key={n}
              type="button"
              className={`${styles.miniChip} ${active ? styles.miniChipActive : ''} ${isSystem ? styles.miniChipSystem : ''}`}
              onClick={() => toggle(n)}
              title={isSystem ? `${n} — system field` : undefined}
            >
              {n}
              {isSystem && <span className={styles.miniChipSysBadge}>SYS</span>}
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

function FormulaBody({
  cond, fieldNames, onChange,
}: {
  cond: Extract<TransitionCondition, { type: 'formula' }>;
  fieldNames: string[];
  onChange: (next: TransitionCondition) => void;
}) {
  // Validated on blur — same fences as the server (single JS
  // expression, no loops/statements), so authors learn about a broken
  // formula while editing, not from the run log.
  const [problem, setProblem] = useState<string | null>(null);

  // Fields-only autocomplete on `{{` — same restricted picker as the
  // Rules addon's value formulas, not the full prompt token set.
  const fieldOptions = useMemo(() => ({
    '@': fieldNames.map(n => ({ label: n, insertion: `{{${n}}}`, group: 'Field' })),
  }), [fieldNames]);

  return (
    <div className={styles.formulaWrap}>
      <FormulaHelpButton mode="when" />
      <MentionTextarea
        value={cond.expr}
        onChange={expr => {
          onChange({ ...cond, expr });
          if (problem) setProblem(null);
        }}
        onBlur={() => setProblem(lintFormula(cond.expr))}
        options={fieldOptions}
        rows={1}
        autoGrow
        minHeight={28}
        spellCheck={false}
        placeholder={'JavaScript · true = match · type {{ to insert a field'}
      />
      {problem && <span className={styles.formulaProblem}>✕ {problem}</span>}
    </div>
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

