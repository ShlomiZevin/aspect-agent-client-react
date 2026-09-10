/**
 * RulesConfig — config UI for the Rules addon.
 *
 * A numbered list of rule cards, each with:
 *   WHEN — the shared ConditionsEditor (empty = always fires).
 *   THEN — an ordered list of actions (set / clear / transition /
 *          stop / reply), each rendered as one compact row.
 *
 * Every field the rules touch is mirrored into
 * `config.extractsFields` so the server resolves field domains at
 * runtime (see addon.rules.js).
 */

import { useMemo, useState } from 'react';
import type { PluginConfigProps } from '../../registry/plugins';
import { useBuilder } from '../../state/BuilderContext';
import { InlineField } from '../../components/AddonModal/InlineField';
import { ComboPicker } from '../../components/Conditions/ComboPicker';
import { ConditionsEditor } from '../../components/Conditions/ConditionsEditor';
import { FormulaHelpButton } from '../../components/Conditions/FormulaHelp';
import { lintFormula } from '../../components/Conditions/formulaLint';
import { MentionTextarea } from '../../components/MentionTextarea/MentionTextarea';
import type { FieldDef, RuleAction, RuleDef, RulesAddonConfig } from '../../types';
import styles from './RulesConfig.module.css';

const newRuleId = () => `rule_${Math.random().toString(36).slice(2, 9)}`;

const ACTION_LABELS: Record<RuleAction['type'], string> = {
  set: 'Set field',
  clear: 'Clear field',
  transition: 'Transition to crew',
  stop: 'Stop chain',
  reply: 'Reply with text',
};

const OP_SIGNS: Record<string, string> = {
  'equals': '=', 'not-equals': '≠', 'contains': '~', 'starts-with': 'starts',
  'ends-with': 'ends', 'gt': '>', 'gte': '≥', 'lt': '<', 'lte': '≤',
  'in': 'in', 'not-in': 'not in', 'is-null': 'is empty', 'is-not-null': 'has a value',
};

/** One-line human summary for a collapsed rule card. */
function summarizeRule(rule: RuleDef, crewName: (id: string) => string): { when: string; then: string } {
  const conditions = rule.conditions ?? [];
  const when = conditions.length === 0
    ? 'Always'
    : conditions.map(c => {
        if (c.type === 'field') {
          if (c.op === 'is-null' || c.op === 'is-not-null') return `${c.field} ${OP_SIGNS[c.op]}`;
          // Which side holds the operand is decided by the OPERATOR, never
          // by truthiness: picking a field leaves `values: []` behind, and an
          // empty array is truthy — that silently rendered every summary
          // with a blank right-hand side.
          const multi = c.op === 'in' || c.op === 'not-in';
          const operand = multi ? (c.values ?? []).map(String).join(' | ') : String(c.value ?? '');
          return `${c.field} ${OP_SIGNS[c.op] ?? c.op} ${operand}`.trim();
        }
        if (c.type === 'formula') return c.expr || '(empty formula)';
        if (c.type === 'fields-collected') return `has ${c.fields.join(', ')}`;
        return c.type;
      }).join(' AND ');
  const then = (rule.actions ?? []).map(a => {
    if (a.type === 'set') {
      const v = a.valueMode === 'formula' ? (a.formula || '?')
        : a.valueMode === 'copy' ? `{{${a.fromField || '?'}}}`
        : JSON.stringify(a.value ?? '?');
      return `set ${a.field || '?'} = ${v}`;
    }
    if (a.type === 'clear') return `clear ${a.field || '?'}`;
    if (a.type === 'transition') return `→ ${a.target ? crewName(a.target) : '?'}`;
    if (a.type === 'stop') return 'stop';
    if (a.type === 'reply') return 'reply';
    return a.type;
  }).join(', ');
  return { when, then: then || 'no actions' };
}

/** Field names every rule touches — mirrored to extractsFields. */
function touchedFields(rules: RuleDef[]): string[] {
  const names = new Set<string>();
  for (const r of rules) {
    for (const a of r.actions) {
      if ((a.type === 'set' || a.type === 'clear') && a.field) names.add(a.field);
      // `#parameter` sources are static config, not extracted fields —
      // they must never reach `extractsFields` (task #826).
      if (a.fromField && !a.fromField.startsWith('#')) names.add(a.fromField);
    }
  }
  return [...names];
}

export function RulesConfigComponent({
  config, onChange, agentId, crewId,
}: PluginConfigProps<RulesAddonConfig>) {
  const { doc } = useBuilder();
  // Formula validation state, keyed `${ruleIdx}:${actionIdx}` — set on
  // blur, cleared while typing. Mirrors the server's fences.
  const [formulaProblems, setFormulaProblems] = useState<Record<string, string | null>>({});
  // Collapsed by default — a list of rules reads as one-line summaries;
  // only the rule being edited is open. New rules open automatically.
  const [openRules, setOpenRules] = useState<Set<string>>(() => new Set());
  const toggleRule = (ruleId: string) => setOpenRules(prev => {
    const next = new Set(prev);
    if (next.has(ruleId)) next.delete(ruleId); else next.add(ruleId);
    return next;
  });

  const agent = useMemo(() => doc.agents.find(a => a.id === agentId), [doc, agentId]);

  const fieldNames = useMemo(() => {
    const names = new Set<string>();
    agent?.fields?.forEach(f => names.add(f.name));
    if (crewId) {
      agent?.crews.find(c => c.id === crewId)?.fields?.forEach(f => names.add(f.name));
    }
    return [...names].sort();
  }, [agent, crewId]);

  /** name → FieldDef. The Fixed-value box needs the TARGET field's
   *  declared type so an enum offers its values instead of free text. */
  const fieldByName = useMemo(() => {
    const map = new Map<string, FieldDef>();
    agent?.fields?.forEach(f => { if (f.name) map.set(f.name, f); });
    if (crewId) {
      agent?.crews.find(c => c.id === crewId)?.fields?.forEach(f => {
        if (f.name && !map.has(f.name)) map.set(f.name, f);
      });
    }
    return map;
  }, [agent, crewId]);

  /** An enum field's declared values, via the agent's enum bible. */
  const enumValuesFor = useMemo(() => (field: FieldDef | undefined): string[] => {
    if (!field || field.type !== 'enum' || !field.enumType) return [];
    const def = (agent?.enums ?? []).find(e => e.id === field.enumType);
    return def ? def.values.map(v => v.value).filter(Boolean) : [];
  }, [agent?.enums]);

  // name → field id. The engine resolves `extractsFields` by ID
  // (addonRunner matches f.id) — rules reference fields by NAME in the
  // UI, so we translate when mirroring into extractsFields.
  const fieldIdByName = useMemo(() => {
    const map = new Map<string, string>();
    agent?.fields?.forEach(f => { if (!map.has(f.name)) map.set(f.name, f.id); });
    if (crewId) {
      agent?.crews.find(c => c.id === crewId)?.fields?.forEach(f => { if (!map.has(f.name)) map.set(f.name, f.id); });
    }
    return map;
  }, [agent, crewId]);

  const crews = useMemo(
    () => (agent?.crews ?? []).filter(c => c.id !== crewId).map(c => ({ id: c.id, name: c.name })),
    [agent, crewId],
  );

  // Agent parameters, offered as `#name` beside the fields (task #826).
  const paramTokens = useMemo(
    () => (agent?.parameters ?? []).map(p => `#${p.name}`),
    [agent?.parameters],
  );
  const paramNames = useMemo(() => new Set(paramTokens), [paramTokens]);
  const hintOf = useMemo(
    () => (o: string) => (agent?.parameters ?? []).find(p => `#${p.name}` === o)?.value,
    [agent?.parameters],
  );

  // Formula autocomplete: FIELDS ONLY, triggered by `{{` — not the
  // full prompt token zoo (@memory !thinking #params …), which makes
  // no sense inside a calculation.
  const fieldMentionOptions = useMemo(() => ({
    '@': [
      ...fieldNames.map(n => ({ label: n, insertion: `{{${n}}}`, group: 'Field' })),
      // Parameters read like fields inside a formula (task #826):
      // `{{age}} >= {{#minorAge}}`.
      ...paramTokens.map(t => ({ label: t, insertion: `{{${t}}}`, group: 'Parameter' })),
    ],
  }), [fieldNames, paramTokens]);

  const rules = config.rules ?? [];

  const commit = (nextRules: RuleDef[]) => {
    const extractsFields = touchedFields(nextRules)
      .map(name => fieldIdByName.get(name))
      .filter((v): v is string => Boolean(v));
    onChange({ ...config, rules: nextRules, extractsFields });
  };

  const updateRule = (idx: number, patch: Partial<RuleDef>) => {
    commit(rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const updateAction = (ruleIdx: number, actionIdx: number, patch: Partial<RuleAction>) => {
    const rule = rules[ruleIdx];
    updateRule(ruleIdx, {
      actions: rule.actions.map((a, i) => (i === actionIdx ? { ...a, ...patch } : a)),
    });
  };

  const addRule = () => {
    const rule: RuleDef = { id: newRuleId(), conditions: [], actions: [{ type: 'set' }] };
    commit([...rules, rule]);
    setOpenRules(prev => new Set(prev).add(rule.id));
  };

  const removeRule = (idx: number) => {
    commit(rules.filter((_, i) => i !== idx));
  };

  const moveRule = (idx: number, dir: -1 | 1) => {
    const next = [...rules];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    commit(next);
  };

  const addAction = (ruleIdx: number) => {
    updateRule(ruleIdx, { actions: [...rules[ruleIdx].actions, { type: 'set' }] });
  };

  const removeAction = (ruleIdx: number, actionIdx: number) => {
    updateRule(ruleIdx, { actions: rules[ruleIdx].actions.filter((_, i) => i !== actionIdx) });
  };

  /**
   * One picker for fields AND parameters — the same component the WHEN
   * row uses, so both halves of a rule look and behave identically
   * (task #826).
   *
   * `allowParams` is false for a WRITE target: a parameter is static
   * agent configuration, so a rule can READ one (compare against it,
   * copy from it) but can never set one. Offering it there would be a
   * write that silently goes nowhere.
   */
  const fieldSelect = (
    value: string | undefined,
    onPick: (v: string) => void,
    placeholder: string,
    allowParams = false,
  ) => (
    <ComboPicker
      className={styles.pickerCombo}
      value={value ?? ''}
      options={allowParams ? [...fieldNames, ...paramTokens] : fieldNames}
      onChange={onPick}
      allowFreeText={false}
      placeholder={placeholder}
      paramNames={paramNames}
      hintOf={hintOf}
    />
  );

  /**
   * The Fixed-value box follows the TARGET field's type: an enum offers
   * its declared values (the same "pick value" the WHEN row gives), a
   * boolean offers true/false, anything else stays free text. Parameters
   * are offered in every case — a parameter may hold the value (#826).
   */
  const fixedValueInput = (action: RuleAction, ruleIdx: number, actionIdx: number) => {
    const target = fieldByName.get(action.field ?? '');
    const enumValues = enumValuesFor(target);
    const set = (v: string) => updateAction(ruleIdx, actionIdx, { value: v });
    const current = String(action.value ?? '');
    if (target?.type === 'enum' && enumValues.length > 0) {
      return (
        <ComboPicker
          className={styles.pickerCombo}
          value={current}
          options={[...enumValues, ...paramTokens]}
          onChange={set}
          allowFreeText={false}
          placeholder="pick value"
          paramNames={paramNames}
          hintOf={hintOf}
        />
      );
    }
    if (target?.type === 'boolean') {
      return (
        <ComboPicker
          className={styles.pickerCombo}
          value={current}
          options={['true', 'false', ...paramTokens]}
          onChange={set}
          allowFreeText={false}
          placeholder="true / false"
          paramNames={paramNames}
          hintOf={hintOf}
        />
      );
    }
    return (
      <ComboPicker
        className={styles.pickerCombo}
        value={current}
        options={paramTokens}
        onChange={set}
        placeholder={paramTokens.length ? 'value or #parameter' : 'value'}
        paramNames={paramNames}
        hintOf={hintOf}
        liveCommit
        suggestPrefix="#"
      />
    );
  };

  const renderAction = (rule: RuleDef, ruleIdx: number, action: RuleAction, actionIdx: number) => {
    const isFormula = action.type === 'set' && action.valueMode === 'formula';
    const problemKey = `${ruleIdx}:${actionIdx}`;
    const problem = formulaProblems[problemKey];

    return (
      <div key={actionIdx} className={styles.actionItem}>
        <div className={styles.actionRow}>
          <select
            className={`${styles.select} ${styles.actionType}`}
            value={action.type}
            onChange={e => updateAction(ruleIdx, actionIdx, {
              type: e.target.value as RuleAction['type'],
              // reset per-type params on type switch
              field: undefined, valueMode: undefined, value: undefined,
              fromField: undefined, compute: undefined, target: undefined, text: undefined,
            })}
          >
            {(Object.keys(ACTION_LABELS) as RuleAction['type'][]).map(t => (
              <option key={t} value={t}>{ACTION_LABELS[t]}</option>
            ))}
          </select>

          <div className={styles.actionParams}>
            {action.type === 'set' && (
              <>
                {fieldSelect(action.field, v => updateAction(ruleIdx, actionIdx, { field: v }), 'field…')}
                <span className={styles.op}>=</span>
                <select
                  className={styles.select}
                  value={action.valueMode ?? 'fixed'}
                  onChange={e => updateAction(ruleIdx, actionIdx, {
                    valueMode: e.target.value as RuleAction['valueMode'],
                    value: undefined, fromField: undefined, compute: undefined,
                  })}
                >
                  <option value="fixed">Fixed value</option>
                  <option value="copy">From field</option>
                  <option value="formula">Formula</option>
                </select>
                {(action.valueMode ?? 'fixed') === 'fixed' &&
                  fixedValueInput(action, ruleIdx, actionIdx)}
                {action.valueMode === 'copy' &&
                  fieldSelect(action.fromField, v => updateAction(ruleIdx, actionIdx, { fromField: v }), 'field or #parameter…', true)}
              </>
            )}

            {action.type === 'clear' &&
              fieldSelect(action.field, v => updateAction(ruleIdx, actionIdx, { field: v }), 'field…')}

            {action.type === 'transition' && (
              <select
                className={styles.select}
                value={action.target ?? ''}
                onChange={e => updateAction(ruleIdx, actionIdx, { target: e.target.value })}
              >
                <option value="">crew…</option>
                {crews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}

            {action.type === 'stop' && (
              <span className={styles.hint}>skips the rest of this turn's chain, including the Talker</span>
            )}

            {action.type === 'reply' && (
              <input
                className={`${styles.input} ${styles.replyInput}`}
                value={action.text ?? ''}
                onChange={e => updateAction(ruleIdx, actionIdx, { text: e.target.value })}
                placeholder="exact reply text — add a Stop action so the Talker doesn't answer too"
                spellCheck={false}
              />
            )}
          </div>

          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => removeAction(ruleIdx, actionIdx)}
            title="Delete this action"
            disabled={rule.actions.length <= 1}
          >
            🗑
          </button>
        </div>

        {/* Formula gets its own full-width line, flush with the action
            type dropdown — a deliberate second row, not a wrap. */}
        {isFormula && (
          <div className={styles.formulaBox}>
            <FormulaHelpButton mode="then" />
            <MentionTextarea
              value={action.formula ?? ''}
              onChange={formula => {
                updateAction(ruleIdx, actionIdx, { formula });
                if (problem) setFormulaProblems(p => ({ ...p, [problemKey]: null }));
              }}
              onBlur={() => setFormulaProblems(p => ({ ...p, [problemKey]: lintFormula(action.formula ?? '') }))}
              options={fieldMentionOptions}
              rows={1}
              autoGrow
              minHeight={28}
              spellCheck={false}
              placeholder={'JavaScript · type {{ to insert a field'}
            />
            {problem && <span className={styles.formulaProblem}>✕ {problem}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      <InlineField label="Name" hint="Shown on the chain card. Leave empty to use the plugin name.">
        <input
          className={styles.input}
          type="text"
          value={config.name ?? ''}
          onChange={e => onChange({ ...config, name: e.target.value })}
          placeholder="e.g. Routing rules (optional)"
          spellCheck={false}
        />
      </InlineField>

      {rules.length === 0 && (
        <div className={styles.empty}>No rules yet — add one below. Rules run top to bottom; every match fires.</div>
      )}

      {rules.map((rule, idx) => {
        const open = openRules.has(rule.id);
        const summary = summarizeRule(rule, tid => crews.find(c => c.id === tid)?.name ?? tid);
        return (
        <div key={rule.id} className={`${styles.rule} ${rule.enabled === false ? styles.ruleDisabled : ''}`}>
          <div
            className={`${styles.ruleHead} ${styles.ruleHeadClickable}`}
            onClick={() => toggleRule(rule.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleRule(rule.id); }}
          >
            <span className={styles.chevron}>{open ? '▾' : '▸'}</span>
            <span className={styles.ruleNum}>RULE {idx + 1}</span>
            {!open && (
              <span className={styles.ruleSummary}>
                <span className={styles.summaryWhen}>{summary.when}</span>
                <span className={styles.summaryArrow}>→</span>
                <span className={styles.summaryThen}>{summary.then}</span>
              </span>
            )}
            <span className={styles.ruleTools} onClick={e => e.stopPropagation()}>
              <button type="button" className={styles.toolBtn} onClick={() => moveRule(idx, -1)} disabled={idx === 0} title="Move up">↑</button>
              <button type="button" className={styles.toolBtn} onClick={() => moveRule(idx, 1)} disabled={idx === rules.length - 1} title="Move down">↓</button>
              <button
                type="button"
                className={styles.toolBtn}
                onClick={() => updateRule(idx, { enabled: rule.enabled === false ? undefined : false })}
                title={rule.enabled === false ? 'Enable rule' : 'Pause rule'}
              >
                {rule.enabled === false ? '▶' : '⏸'}
              </button>
              <button type="button" className={`${styles.toolBtn} ${styles.toolDanger}`} onClick={() => removeRule(idx)} title="Delete rule">🗑</button>
            </span>
          </div>

          {open && (
            <>
              <div className={`${styles.zone} ${styles.zoneWhen}`}>
                <ConditionsEditor
                  conditions={rule.conditions}
                  onChange={conditions => updateRule(idx, { conditions })}
                  agentId={agentId}
                  crewId={crewId}
                  title={<span className={`${styles.kw} ${styles.kwWhen}`}>WHEN</span>}
                  emptyMessage="No conditions — this rule always fires (a computed field)."
                  flat
                />
              </div>

              <div className={`${styles.zone} ${styles.zoneThen}`}>
                <div className={styles.thenHead}>
                  <span className={`${styles.kw} ${styles.kwThen}`}>THEN</span>
                  <button type="button" className={styles.addAction} onClick={() => addAction(idx)}>
                    + Add
                  </button>
                </div>
                <div className={styles.zoneBody}>
                  {rule.actions.map((a, ai) => renderAction(rule, idx, a, ai))}
                </div>
              </div>
            </>
          )}
        </div>
        );
      })}

      <button type="button" className={styles.addRule} onClick={addRule}>
        + Add rule
      </button>
      {rules.length > 0 && (
        <div className={styles.footHint}>
          Rules run top to bottom. Every matching rule fires; a later rule can overwrite an earlier one.
        </div>
      )}
    </div>
  );
}
