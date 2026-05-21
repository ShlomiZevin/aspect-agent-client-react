import { useState, useEffect, useCallback } from 'react';
import styles from './LLMUsagePage.module.css';
import { CostCalculatorPanel } from './CostCalculatorPanel';

interface Props {
  baseURL?: string;
  agentName: string;
  /**
   * URL slug of the agent (e.g. 'banking-v2'). Sent alongside
   * `agentName` so the server can match V2 builder rows (whose
   * `agent_name` column holds the slug) AND legacy rows (whose
   * `agent_name` holds the display name) in the same view.
   */
  agentSlug?: string;
}

// Agents that have a customer data schema (zer4u/SQL flow). Cost calculator
// only makes sense for these — Freeda/Lybi/Banking etc. don't run SQL queries.
const DATA_INCLUDED_AGENTS = new Set(['zer4u', 'aspect', 'newdeli', 'thestock', 'hypertoy', 'onezero']);

interface UsageRow {
  id: number;
  agentName: string | null;
  crewMember: string | null;
  process: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number | null;
  conversationId: string | null;
  userId: number | null;
  createdAt: string;
}

interface ProcessSummary {
  process: string;
  count: number;
  totalInput: number;
  totalOutput: number;
  avgDurationMs: number;
}

interface ModelSummary {
  model: string;
  provider: string;
  count: number;
  totalInput: number;
  totalOutput: number;
  avgDurationMs: number;
}

// Client-side cost estimation ($/M tokens)
const COST_PER_M: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gemini-2.5-flash': { input: 0.15, output: 0.6 },
  'gemini-2.5-pro': { input: 1.25, output: 10 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_M[model];
  if (!rates) return 0;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Stable per-process color. Hash the name → pick a palette entry.
 * Means new processes (e.g. addon plugin ids from V2 builder) get a
 * distinct color automatically, no CSS update needed. Same name
 * always picks the same color across renders & reloads.
 */
const PROCESS_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: '#e0e7ff', fg: '#4338ca' }, // indigo (matches legacy 'thinker')
  { bg: '#fce7f3', fg: '#be185d' }, // pink (legacy 'profiler')
  { bg: '#d1fae5', fg: '#065f46' }, // green (legacy 'field_extractor')
  { bg: '#fef3c7', fg: '#92400e' }, // amber (legacy 'conversation')
  { bg: '#dbeafe', fg: '#1d4ed8' }, // blue
  { bg: '#ede9fe', fg: '#6d28d9' }, // violet
  { bg: '#fee2e2', fg: '#b91c1c' }, // rose
  { bg: '#ccfbf1', fg: '#0f766e' }, // teal
  { bg: '#fed7aa', fg: '#9a3412' }, // orange
];

function getProcessStyle(process: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < process.length; i++) {
    hash = (hash * 31 + process.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % PROCESS_PALETTE.length;
  const c = PROCESS_PALETTE[idx];
  return { background: c.bg, color: c.fg };
}

export function LLMUsagePage({ baseURL, agentName, agentSlug }: Props) {
  const apiBase = baseURL || import.meta.env.VITE_API_URL || '';
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [byProcess, setByProcess] = useState<ProcessSummary[]>([]);
  const [byModel, setByModel] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Default: today
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${fromDate}T00:00:00`;
      const to = `${toDate}T23:59:59`;
      const agentParam = `&agent=${encodeURIComponent(agentName)}`;
      // Send the slug too — server ORs both so V2 builder rows
      // (stored with agent_name=slug) surface alongside legacy rows
      // (stored with agent_name=display name).
      const slugParam = agentSlug ? `&slug=${encodeURIComponent(agentSlug)}` : '';

      const [rowsRes, summaryRes] = await Promise.all([
        fetch(`${apiBase}/api/admin/usage?from=${from}&to=${to}&limit=200${agentParam}${slugParam}`),
        fetch(`${apiBase}/api/admin/usage/summary?from=${from}&to=${to}${agentParam}${slugParam}`),
      ]);

      const rowsData = await rowsRes.json();
      const summaryData = await summaryRes.json();

      setRows(rowsData.rows || []);
      setTotal(rowsData.total || 0);
      setByProcess(summaryData.byProcess || []);
      setByModel(summaryData.byModel || []);
    } catch (err) {
      console.error('Failed to fetch usage:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase, fromDate, toDate, agentName, agentSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute totals
  const totalInput = byProcess.reduce((s, p) => s + p.totalInput, 0);
  const totalOutput = byProcess.reduce((s, p) => s + p.totalOutput, 0);
  const totalEstCost = byModel.reduce((s, m) => s + estimateCost(m.model, m.totalInput, m.totalOutput), 0);
  const totalCalls = byProcess.reduce((s, p) => s + p.count, 0);

  // Compute cost per process from individual rows
  const costByProcess: Record<string, number> = {};
  for (const r of rows) {
    costByProcess[r.process] = (costByProcess[r.process] || 0) + estimateCost(r.model, r.inputTokens, r.outputTokens);
  }

  const showCalculator = DATA_INCLUDED_AGENTS.has((agentName || '').toLowerCase());

  return (
    <div className={`${styles.container} ${showCalculator ? styles.containerWithSidebar : ''}`}>
      <div className={styles.mainColumn}>
      <div className={styles.header}>
        <h1 className={styles.title}>LLM Usage</h1>
        <div className={styles.dateRange}>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <span>-</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          <button onClick={fetchData}>Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className={styles.cards}>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Total Calls</div>
              <div className={styles.cardValue}>{totalCalls.toLocaleString()}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Input Tokens</div>
              <div className={styles.cardValue}>{formatTokens(totalInput)}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Output Tokens</div>
              <div className={styles.cardValue}>{formatTokens(totalOutput)}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardLabel}>Est. Cost</div>
              <div className={`${styles.cardValue} ${styles.costHighlight}`}>{formatCost(totalEstCost)}</div>
            </div>
          </div>

          {/* By Process */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>By Process</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Process</th>
                  <th>Calls</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Avg Input</th>
                  <th>Avg Output</th>
                  <th>Avg Time</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {byProcess.map(p => (
                  <tr key={p.process}>
                    <td><span className={styles.processBadge} style={getProcessStyle(p.process)}>{p.process}</span></td>
                    <td>{p.count}</td>
                    <td>{formatTokens(p.totalInput)}</td>
                    <td>{formatTokens(p.totalOutput)}</td>
                    <td>{p.count ? formatTokens(Math.round(p.totalInput / p.count)) : '-'}</td>
                    <td>{p.count ? formatTokens(Math.round(p.totalOutput / p.count)) : '-'}</td>
                    <td>{p.avgDurationMs ? `${(p.avgDurationMs / 1000).toFixed(1)}s` : '-'}</td>
                    <td className={styles.costHighlight}>{formatCost(costByProcess[p.process] || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By Model */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>By Model</h2>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Provider</th>
                  <th>Calls</th>
                  <th>Input</th>
                  <th>Output</th>
                  <th>Avg Input</th>
                  <th>Avg Output</th>
                  <th>Avg Time</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map(m => (
                  <tr key={`${m.model}-${m.provider}`}>
                    <td>{m.model}</td>
                    <td>{m.provider}</td>
                    <td>{m.count}</td>
                    <td>{formatTokens(m.totalInput)}</td>
                    <td>{formatTokens(m.totalOutput)}</td>
                    <td>{m.count ? formatTokens(Math.round(m.totalInput / m.count)) : '-'}</td>
                    <td>{m.count ? formatTokens(Math.round(m.totalOutput / m.count)) : '-'}</td>
                    <td>{m.avgDurationMs ? `${(m.avgDurationMs / 1000).toFixed(1)}s` : '-'}</td>
                    <td className={styles.costHighlight}>{formatCost(estimateCost(m.model, m.totalInput, m.totalOutput))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent calls */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent Calls ({total} total)</h2>
            {rows.length === 0 ? (
              <div className={styles.empty}>No usage data for this period</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Process</th>
                    <th>Model</th>
                    <th>Crew</th>
                    <th>Input</th>
                    <th>Output</th>
                    <th>Duration</th>
                    <th>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id}>
                      <td>{new Date(r.createdAt).toLocaleTimeString()}</td>
                      <td><span className={styles.processBadge} style={getProcessStyle(r.process)}>{r.process}</span></td>
                      <td>{r.model}</td>
                      <td>{r.crewMember || '-'}</td>
                      <td>{formatTokens(r.inputTokens)}</td>
                      <td>{formatTokens(r.outputTokens)}</td>
                      <td>{r.durationMs ? `${(r.durationMs / 1000).toFixed(1)}s` : '-'}</td>
                      <td className={styles.costHighlight}>{formatCost(estimateCost(r.model, r.inputTokens, r.outputTokens))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      </div>
      {showCalculator && (
        <CostCalculatorPanel byProcess={byProcess} byModel={byModel} />
      )}
    </div>
  );
}
