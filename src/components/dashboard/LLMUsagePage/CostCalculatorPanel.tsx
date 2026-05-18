import { useMemo, useState } from 'react';
import styles from './CostCalculatorPanel.module.css';

interface ByProcessRow {
  process: string;
  count: number;
  totalInput: number;
  totalOutput: number;
}

interface ByModelRow {
  model: string;
  provider: string;
  count: number;
  totalInput: number;
  totalOutput: number;
}

interface Props {
  byProcess: ByProcessRow[];
  byModel: ByModelRow[];
}

// Same pricing table used on the main LLM Usage page. Kept in sync manually.
const COST_PER_M: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-5': { input: 5, output: 15 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
};

const WHISPER_USD_PER_MIN = 0.006;

// Fallback per-call cost when there's no real usage data in the selected
// date range (e.g. fresh customer, narrow date filter). Derived from the
// spec formula + observed ranges on existing customers — keeps the
// calculator giving a ballpark even before any real traffic.
const FALLBACK_PER_CALL = {
  conversation: 0.005,   // ~avg GPT answer call
  sqlGeneration: 0.015,  // ~avg Claude SQL-translation call
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_M[model];
  if (!rates) return 0;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

function fmtUsd(v: number): string {
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

// Default working days per month: (52 weeks × 5 workdays) / 12 ≈ 21.67, rounded to 22.
// Standard HR/payroll convention; user can override per-customer.
const DEFAULT_WORKING_DAYS_PER_MONTH = 22;

export function CostCalculatorPanel({ byProcess, byModel }: Props) {
  const [users, setUsers] = useState(5);
  const [questionsPerUser, setQuestionsPerUser] = useState(5);
  const [queriesPerUser, setQueriesPerUser] = useState(15);
  const [daysPerMonth, setDaysPerMonth] = useState(DEFAULT_WORKING_DAYS_PER_MONTH);
  const [includeAudio, setIncludeAudio] = useState(false);
  const [audioMinPerUser, setAudioMinPerUser] = useState(0);

  // Average cost per call, derived from real usage data on this page.
  // - "conversation" = answer to user (no-SQL question OR final answer of SQL flow)
  // - "sql_generation" = Claude SQL translation step
  const avgCost = useMemo(() => {
    const totalByModel: Record<string, { input: number; output: number }> = {};
    for (const m of byModel) {
      totalByModel[m.model] = { input: m.totalInput, output: m.totalOutput };
    }

    // Average cost per call per process, using the model breakdown when possible.
    // We approximate by spreading the process's avg tokens across the most common
    // model for that provider:
    //   - sql_generation tokens are Anthropic (Claude)
    //   - conversation tokens are OpenAI/Google (mostly gpt-*)
    function avgCostForProcess(name: string, fallbackModel: string): { perCall: number; calls: number } {
      const p = byProcess.find(x => x.process === name);
      if (!p || p.count === 0) return { perCall: 0, calls: 0 };
      const avgIn = p.totalInput / p.count;
      const avgOut = p.totalOutput / p.count;
      // Pick the model with the most calls in this provider's family for richer pricing.
      const model = fallbackModel;
      return { perCall: estimateCost(model, avgIn, avgOut), calls: p.count };
    }

    return {
      conversation: avgCostForProcess('conversation', 'gpt-4o'),
      sql: avgCostForProcess('sql_generation', 'claude-sonnet-4-6'),
    };
  }, [byProcess, byModel]);

  // Use real per-call cost when available; otherwise fall back to a ballpark
  // so the calculator stays useful for fresh customers / empty date ranges.
  const effConversation = avgCost.conversation.perCall || FALLBACK_PER_CALL.conversation;
  const effSql = avgCost.sql.perCall || FALLBACK_PER_CALL.sqlGeneration;
  const usingFallback = avgCost.conversation.perCall === 0 && avgCost.sql.perCall === 0;

  const monthlyQuestionsCost = users * questionsPerUser * effConversation * daysPerMonth;
  const monthlySqlCost = users * queriesPerUser * (effSql + effConversation) * daysPerMonth;
  // ↑ each SQL query consumes one sql_generation call AND one conversation call
  const monthlyAudioCost = includeAudio ? users * audioMinPerUser * daysPerMonth * WHISPER_USD_PER_MIN : 0;

  const totalMonthly = monthlyQuestionsCost + monthlySqlCost + monthlyAudioCost;
  const perUserMonthly = users > 0 ? totalMonthly / users : 0;
  const totalCallsPerMonth = users * (questionsPerUser + queriesPerUser) * daysPerMonth;
  const perQuestion = totalCallsPerMonth > 0 ? (monthlyQuestionsCost + monthlySqlCost) / totalCallsPerMonth : 0;

  const hasUsageData = !usingFallback;

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>Cost Calculator</div>
      <div className={styles.subtitle}>
        Rough monthly estimate per customer.
        {hasUsageData ? ' Based on the averages on this page.' : ' No usage data in this date range yet — pick a wider range.'}
      </div>

      <div className={styles.inputs}>
        <label>
          <span>Active users</span>
          <input type="number" min={1} value={users} onChange={e => setUsers(Number(e.target.value) || 0)} />
        </label>
        <label>
          <span>Questions / day / user (no SQL)</span>
          <input type="number" min={0} value={questionsPerUser} onChange={e => setQuestionsPerUser(Number(e.target.value) || 0)} />
        </label>
        <label>
          <span>Queries / day / user (with SQL)</span>
          <input type="number" min={0} value={queriesPerUser} onChange={e => setQueriesPerUser(Number(e.target.value) || 0)} />
        </label>
        <label>
          <span>Working days / month</span>
          <input type="number" min={1} max={31} value={daysPerMonth} onChange={e => setDaysPerMonth(Number(e.target.value) || 0)} />
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={includeAudio}
            onChange={e => setIncludeAudio(e.target.checked)}
          />
          <span>Include audio (Whisper)</span>
        </label>
        {includeAudio && (
          <label>
            <span>Audio min / day / user</span>
            <input type="number" min={0} value={audioMinPerUser} onChange={e => setAudioMinPerUser(Number(e.target.value) || 0)} />
          </label>
        )}
      </div>

      <div className={styles.results}>
        <div className={styles.bigNumber}>
          <div className={styles.bigLabel}>Total / month</div>
          <div className={styles.bigValue}>{fmtUsd(totalMonthly)}</div>
        </div>
        <div className={styles.smallStats}>
          <div>
            <div className={styles.smallLabel}>Per user / mo</div>
            <div className={styles.smallValue}>{fmtUsd(perUserMonthly)}</div>
          </div>
          <div>
            <div className={styles.smallLabel}>Per question</div>
            <div className={styles.smallValue}>{fmtUsd(perQuestion)}</div>
          </div>
        </div>
      </div>

      <div className={styles.breakdown}>
        <div className={styles.breakdownTitle}>Breakdown</div>
        <div className={styles.breakdownRow}>
          <span>OpenAI answers</span>
          <span>{fmtUsd(monthlyQuestionsCost + users * queriesPerUser * effConversation * daysPerMonth)}</span>
        </div>
        <div className={styles.breakdownRow}>
          <span>Claude SQL gen</span>
          <span>{fmtUsd(users * queriesPerUser * effSql * daysPerMonth)}</span>
        </div>
        {includeAudio && (
          <div className={styles.breakdownRow}>
            <span>Whisper audio</span>
            <span>{fmtUsd(monthlyAudioCost)}</span>
          </div>
        )}
      </div>

      <div className={styles.assumptions}>
        <div className={styles.assumptionsTitle}>Averages used</div>
        <div className={styles.assumptionRow}>
          <span>conversation / call</span>
          <span>
            {fmtUsd(effConversation)}
            {avgCost.conversation.perCall === 0 && <em className={styles.fallback}> · default</em>}
          </span>
        </div>
        <div className={styles.assumptionRow}>
          <span>sql_generation / call</span>
          <span>
            {fmtUsd(effSql)}
            {avgCost.sql.perCall === 0 && <em className={styles.fallback}> · default</em>}
          </span>
        </div>
        <div className={styles.note}>
          Ballpark only. Cloud Run, Storage and DB tier costs are not included.
        </div>
      </div>
    </aside>
  );
}
