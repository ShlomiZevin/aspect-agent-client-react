import { useState, useEffect, useCallback } from 'react';
import styles from './BillingPage.module.css';

interface Props {
  baseURL?: string;
}

interface ModelBreakdown {
  [model: string]: {
    input_tokens: number;
    output_tokens: number;
    cost_usd?: number;
  };
}

interface ProviderBilling {
  provider: string;
  period?: { start: string; end: string };
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalTokens?: number;
  totalCostUsd?: number | null;
  totalCostLocal?: number | null;
  currency?: string | null;
  modelBreakdown?: ModelBreakdown;
  serviceBreakdown?: Record<string, number>;
  error?: string | null;
  status?: string;
  message?: string;
  setupUrl?: string;
}

interface BillingData {
  openai: ProviderBilling;
  anthropic: ProviderBilling;
  google: ProviderBilling;
}

function formatTokens(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCost(usd?: number | null): string {
  if (usd == null) return '—';
  return `$${usd.toFixed(4)}`;
}

function ProviderCard({ data }: { data: ProviderBilling }) {
  const providerLabel: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google Cloud',
  };

  const providerColor: Record<string, string> = {
    openai: '#10a37f',
    anthropic: '#d97706',
    google: '#4285f4',
  };

  const label = providerLabel[data.provider] || data.provider;
  const color = providerColor[data.provider] || '#6b7280';
  const isNotConfigured = data.status === 'not_configured' || data.error === 'not_configured' || (data.error && data.error.toLowerCase().includes('not configured'));
  const hasError = !!data.error && !isNotConfigured;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.providerBadge} style={{ background: color }}>{label}</span>
        {data.period && (
          <span className={styles.period}>{data.period.start} – {data.period.end}</span>
        )}
      </div>

      {isNotConfigured ? (
        <div className={styles.notConfigured}>
          <p>{data.message || 'API key not configured yet.'}</p>
          {data.setupUrl && (
            <a href={data.setupUrl} target="_blank" rel="noreferrer" className={styles.setupLink}>
              Open console →
            </a>
          )}
        </div>
      ) : hasError ? (
        <div className={styles.errorBox}>
          <span className={styles.errorIcon}>⚠</span>
          <span>{data.error}</span>
        </div>
      ) : (
        <>
          <div className={styles.statsRow}>
            {data.provider !== 'google' && (
              <>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Input Tokens</div>
                  <div className={styles.statValue}>{formatTokens(data.totalInputTokens)}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Output Tokens</div>
                  <div className={styles.statValue}>{formatTokens(data.totalOutputTokens)}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Total Tokens</div>
                  <div className={styles.statValue}>{formatTokens(data.totalTokens)}</div>
                </div>
              </>
            )}
            <div className={`${styles.stat} ${styles.statCost}`}>
              <div className={styles.statLabel}>Total Cost (USD)</div>
              <div className={styles.statValue}>{formatCost(data.totalCostUsd)}</div>
            </div>
            {data.totalCostLocal != null && data.currency && data.currency !== 'USD' && (
              <div className={styles.stat}>
                <div className={styles.statLabel}>Total Cost ({data.currency})</div>
                <div className={styles.statValue}>{data.totalCostLocal.toFixed(2)} {data.currency}</div>
              </div>
            )}
          </div>

          {data.modelBreakdown && Object.keys(data.modelBreakdown).length > 0 && (
            <div className={styles.breakdown}>
              <div className={styles.breakdownTitle}>Model Breakdown</div>
              <table className={styles.breakdownTable}>
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Input</th>
                    <th>Output</th>
                    {Object.values(data.modelBreakdown).some(m => m.cost_usd != null) && <th>Cost</th>}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.modelBreakdown).map(([model, stats]) => (
                    <tr key={model}>
                      <td className={styles.modelName}>{model}</td>
                      <td>{formatTokens(stats.input_tokens)}</td>
                      <td>{formatTokens(stats.output_tokens)}</td>
                      {stats.cost_usd != null && <td>{formatCost(stats.cost_usd)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.serviceBreakdown && Object.keys(data.serviceBreakdown).length > 0 && (
            <div className={styles.breakdown}>
              <div className={styles.breakdownTitle}>Service Breakdown</div>
              <table className={styles.breakdownTable}>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.serviceBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([svc, cost]) => (
                      <tr key={svc}>
                        <td className={styles.modelName}>{svc}</td>
                        <td>{formatCost(cost)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BillingPage({ baseURL }: Props) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `${baseURL || ''}/api/admin/billing`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [baseURL]);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>API Billing</h1>
          <p className={styles.subtitle}>Current month usage and costs across all LLM providers</p>
        </div>
        <div className={styles.headerActions}>
          {lastRefreshed && (
            <span className={styles.lastRefreshed}>
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button className={styles.refreshBtn} onClick={fetchBilling} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.globalError}>
          Failed to load billing data: {error}
        </div>
      )}

      {loading && !data && (
        <div className={styles.loadingState}>Loading billing data…</div>
      )}

      {data && (
        <div className={styles.cards}>
          <ProviderCard data={data.openai} />
          <ProviderCard data={data.anthropic} />
          <ProviderCard data={data.google} />
        </div>
      )}
    </div>
  );
}
