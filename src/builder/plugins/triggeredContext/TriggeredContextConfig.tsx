/**
 * TriggeredContextConfig — config UI for the Triggered Context addon.
 *
 * Layout:
 *   1. Identity row — name + writes-to domain (the brain section
 *      sub-key all rules of this loader write under). Domain defaults
 *      to 'triggered' on the server if left empty.
 *   2. Rules list — Switch card or Custom card. Two side-by-side
 *      "+ Switch rule" / "+ Custom rule" buttons (no dropdown menu).
 *
 *   Switch card  — pick a field ONCE, then per-value cases. Memory
 *                  key is the field name itself. When the field is
 *                  an enum, "+ Case" suggests unused enum values.
 *
 *   Custom card  — full AND-of-conditions (shared ConditionsEditor)
 *                  + one contextText. The rule's `label` is slugified
 *                  to derive the memory key. Empty label still fires
 *                  (server falls back to `rule_<id>`); placeholder
 *                  nudges the user to name it.
 */

import { useMemo, useState } from 'react';
import type { PluginConfigProps } from '../../registry/plugins';
import { ConditionsEditor } from '../../components/Conditions/ConditionsEditor';
import { ComboPicker } from '../../components/Conditions/ComboPicker';
import { useCrewFields } from '../../state/useCrewFields';
import type {
  FieldDef,
  TransitionCondition,
  TriggeredContextConfig,
  TriggeredMatchRule,
  TriggeredRule,
  TriggeredSwitchCase,
  TriggeredSwitchRule,
} from '../../types';
import styles from './TriggeredContextConfig.module.css';

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptySwitchRule(): TriggeredSwitchRule {
  return {
    id:    newId('rule'),
    kind:  'switch',
    field: '',
    cases: [],
  };
}

function emptyMatchRule(): TriggeredMatchRule {
  return {
    id:          newId('rule'),
    kind:        'match',
    name:        '',
    conditions:  [],
    contextText: '',
  };
}

export function TriggeredContextConfigComponent({
  config,
  onChange,
  agentId,
  crewId,
}: PluginConfigProps<TriggeredContextConfig>) {
  const patch = (next: Partial<TriggeredContextConfig>) => onChange({ ...config, ...next });

  const updateRule = (id: string, mut: (r: TriggeredRule) => TriggeredRule) => {
    patch({ rules: config.rules.map(r => r.id === id ? mut(r) : r) });
  };
  const removeRule = (id: string) => patch({ rules: config.rules.filter(r => r.id !== id) });
  const addRule    = (kind: TriggeredRule['kind']) => {
    const created: TriggeredRule = kind === 'switch' ? emptySwitchRule() : emptyMatchRule();
    patch({ rules: [...config.rules, created] });
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.identityRow}>
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input
            className={styles.input}
            type="text"
            value={config.name ?? ''}
            onChange={e => patch({ name: e.target.value })}
            placeholder="e.g. Intent Director (optional)"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Writes to · domain</span>
          <input
            className={styles.input}
            type="text"
            value={config.domain ?? ''}
            onChange={e => patch({ domain: e.target.value })}
            placeholder="triggered"
          />
        </label>
      </div>

      <p className={styles.hint}>
        Matched rules write their text into the brain's <code>triggered</code>
        section. Each rule's memory key is auto-derived: <strong>Switch</strong>
        rules write to the source field name; <strong>Custom</strong> rules
        write to a slugified version of their label.
      </p>

      <div className={styles.rulesHeader}>
        <span className={styles.rulesTitle}>
          Rules <span className={styles.rulesCount}>· {config.rules.length}</span>
        </span>
        <div className={styles.addButtons}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => addRule('switch')}
            title="One field, multiple values → text per value"
          >
            + Switch rule
          </button>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => addRule('match')}
            title="AND of multiple conditions → one text"
          >
            + Custom rule
          </button>
        </div>
      </div>

      {config.rules.length === 0 ? (
        <div className={styles.empty}>
          No rules yet. <strong>Switch</strong> for "if field X equals A do
          this, B do that" patterns; <strong>Custom</strong> for
          AND-of-conditions like "intent=complaint AND mood=stubborn".
        </div>
      ) : (
        <div className={styles.rules}>
          {config.rules.map(r => (
            r.kind === 'switch'
              ? <SwitchRuleCard
                  key={r.id}
                  rule={r}
                  agentId={agentId}
                  crewId={crewId}
                  onChange={mut => updateRule(r.id, mut as (r: TriggeredRule) => TriggeredRule)}
                  onRemove={() => removeRule(r.id)}
                />
              : <MatchRuleCard
                  key={r.id}
                  rule={r}
                  agentId={agentId}
                  crewId={crewId}
                  onChange={mut => updateRule(r.id, mut as (r: TriggeredRule) => TriggeredRule)}
                  onRemove={() => removeRule(r.id)}
                />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Switch rule card ────────────────────── */

interface SwitchCardProps {
  rule: TriggeredSwitchRule;
  agentId: string;
  crewId: string;
  onChange: (mut: (r: TriggeredSwitchRule) => TriggeredSwitchRule) => void;
  onRemove: () => void;
}

function SwitchRuleCard({ rule, agentId, crewId, onChange, onRemove }: SwitchCardProps) {
  const { allFields } = useCrewFields(agentId, crewId);

  const fieldByName = useMemo(() => {
    const map = new Map<string, FieldDef>();
    for (const cf of allFields) {
      if (cf.field.name) map.set(cf.field.name, cf.field);
    }
    return map;
  }, [allFields]);

  const fieldNames = useMemo(() => [...fieldByName.keys()].sort(), [fieldByName]);
  const pickedField = fieldByName.get(rule.field);
  const isEnum =
    pickedField?.type === 'enum'
    && Array.isArray(pickedField.enumValues)
    && pickedField.enumValues.length > 0;

  const usedValues = useMemo(() => new Set(rule.cases.map(c => String(c.value))), [rule.cases]);
  const availableEnumValues = useMemo(() => {
    if (!isEnum) return [];
    return (pickedField!.enumValues ?? []).filter(v => !usedValues.has(String(v)));
  }, [isEnum, pickedField, usedValues]);

  const addCase = (value: string = '') => {
    const next: TriggeredSwitchCase = { value, contextText: '' };
    onChange(r => ({ ...r, cases: [...r.cases, next] }));
  };
  const updateCase = (idx: number, mut: (c: TriggeredSwitchCase) => TriggeredSwitchCase) => {
    onChange(r => ({ ...r, cases: r.cases.map((c, i) => i === idx ? mut(c) : c) }));
  };
  const removeCase = (idx: number) => {
    onChange(r => ({ ...r, cases: r.cases.filter((_, i) => i !== idx) }));
  };

  return (
    <div className={styles.ruleCard}>
      <div className={styles.ruleHeader}>
        <span className={styles.kindBadge} title="Switch on a field — one value per case">
          Switch on
        </span>
        {/* Same picker the ConditionsEditor uses — autocomplete +
         * dropdown over the crew's field names. Picking a different
         * field clears existing cases since their values are tied to
         * the previous field's shape. */}
        <ComboPicker
          value={rule.field}
          options={fieldNames}
          onChange={v => onChange(r => ({ ...r, field: v, cases: [] }))}
          placeholder="pick a field"
          className={styles.headerCombo}
        />
        <span className={styles.headerSpacer} />
        <button
          type="button"
          className={styles.ruleRemove}
          onClick={onRemove}
          title="Remove rule"
          aria-label="Remove rule"
        >
          ✕
        </button>
      </div>

      {!rule.field ? (
        <div className={styles.casesEmpty}>
          Pick a field above to start adding cases.
        </div>
      ) : (
        <CasesList
          rule={rule}
          isEnum={isEnum}
          availableEnumValues={availableEnumValues}
          onAddCase={addCase}
          onUpdateCase={updateCase}
          onRemoveCase={removeCase}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Cases list ──────────────────────────── */

function CasesList({
  rule, isEnum, availableEnumValues, onAddCase, onUpdateCase, onRemoveCase,
}: {
  rule: TriggeredSwitchRule;
  isEnum: boolean;
  availableEnumValues: string[];
  onAddCase: (value?: string) => void;
  onUpdateCase: (idx: number, mut: (c: TriggeredSwitchCase) => TriggeredSwitchCase) => void;
  onRemoveCase: (idx: number) => void;
}) {
  // Default to expanded only for empty cases (so newly-added cases are
  // immediately editable). Once a case has text, default to collapsed.
  const initialOpen = useMemo(() => {
    return new Set(
      rule.cases
        .map((c, i) => ({ idx: i, empty: !c.contextText.trim() }))
        .filter(x => x.empty)
        .map(x => x.idx),
    );
  }, [rule.cases]);
  const [openIdx, setOpenIdx] = useState<Set<number>>(initialOpen);

  const toggle = (i: number) => {
    setOpenIdx(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div className={styles.cases}>
      <div className={styles.casesHeader}>
        <span className={styles.casesLabel}>Cases · {rule.cases.length}</span>
        {isEnum && availableEnumValues.length > 0 ? (
          <div className={styles.enumSuggestRow}>
            <span className={styles.enumSuggestHint}>Suggested:</span>
            {availableEnumValues.map(v => (
              <button
                key={v}
                type="button"
                className={styles.enumSuggestChip}
                onClick={() => onAddCase(String(v))}
                title={`Add case for "${v}"`}
              >
                + {v}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className={styles.addCaseBtn}
            onClick={() => onAddCase()}
          >
            + Case
          </button>
        )}
      </div>

      {rule.cases.length === 0 ? (
        <div className={styles.casesEmpty}>
          No cases yet. Add one for each value you want to handle.
        </div>
      ) : (
        <div className={styles.caseList}>
          {rule.cases.map((c, i) => (
            <CaseRow
              key={i}
              value={c.value}
              contextText={c.contextText}
              open={openIdx.has(i)}
              onToggle={() => toggle(i)}
              onChangeValue={v => onUpdateCase(i, prev => ({ ...prev, value: v }))}
              onChangeText={t => onUpdateCase(i, prev => ({ ...prev, contextText: t }))}
              onRemove={() => onRemoveCase(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CaseRow({
  value, contextText, open, onToggle, onChangeValue, onChangeText, onRemove,
}: {
  value: string;
  contextText: string;
  open: boolean;
  onToggle: () => void;
  onChangeValue: (v: string) => void;
  onChangeText: (t: string) => void;
  onRemove: () => void;
}) {
  const charCount = contextText.length;
  return (
    <div className={`${styles.caseRow} ${open ? styles.caseRowOpen : ''}`}>
      <div className={styles.caseHead}>
        <button
          type="button"
          className={styles.caseToggle}
          onClick={onToggle}
          aria-label={open ? 'Collapse case' : 'Expand case'}
        >
          {open ? '▾' : '▸'}
        </button>
        <input
          className={styles.caseValueInput}
          type="text"
          value={value}
          onChange={e => onChangeValue(e.target.value)}
          placeholder="value"
          spellCheck={false}
        />
        <span className={styles.caseChars}>
          {charCount === 0 ? 'empty' : `${charCount} chars`}
        </span>
        <button
          type="button"
          className={styles.caseRemove}
          onClick={onRemove}
          title="Remove case"
          aria-label="Remove case"
        >
          ✕
        </button>
      </div>
      {open && (
        <textarea
          className={styles.caseTextarea}
          value={contextText}
          onChange={e => onChangeText(e.target.value)}
          rows={6}
          placeholder={`Text injected when value equals "${value || '...'}"`}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Custom rule card ────────────────────── */

interface MatchCardProps {
  rule: TriggeredMatchRule;
  agentId: string;
  crewId: string;
  onChange: (mut: (r: TriggeredMatchRule) => TriggeredMatchRule) => void;
  onRemove: () => void;
}

function MatchRuleCard({ rule, agentId, crewId, onChange, onRemove }: MatchCardProps) {
  const setConditions = (conditions: TransitionCondition[]) =>
    onChange(r => ({ ...r, conditions }));

  return (
    <div className={styles.ruleCard}>
      <div className={styles.ruleHeader}>
        <span className={styles.kindBadge} title="Custom rule — AND-of-conditions">
          Custom
        </span>
        <input
          className={styles.headerNameInput}
          type="text"
          value={rule.name ?? ''}
          onChange={e => onChange(r => ({ ...r, name: e.target.value }))}
          placeholder="key — e.g. complaint_handling"
          spellCheck={false}
        />
        <span className={styles.headerSpacer} />
        <button
          type="button"
          className={styles.ruleRemove}
          onClick={onRemove}
          title="Remove rule"
          aria-label="Remove rule"
        >
          ✕
        </button>
      </div>

      <ConditionsEditor
        conditions={rule.conditions}
        onChange={setConditions}
        agentId={agentId}
        crewId={crewId}
        emptyMessage="No conditions — this rule will never fire. Add one above."
      />

      <label className={styles.ruleText}>
        <span className={styles.ruleTextLabel}>Context text</span>
        <textarea
          className={styles.ruleTextarea}
          value={rule.contextText}
          onChange={e => onChange(r => ({ ...r, contextText: e.target.value }))}
          rows={6}
          placeholder="Markdown-friendly text injected into the prompt when this rule fires."
        />
      </label>
    </div>
  );
}
