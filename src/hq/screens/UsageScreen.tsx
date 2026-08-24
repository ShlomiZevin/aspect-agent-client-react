/**
 * HQ — what our own workers cost.
 *
 * Separate from the admin usage page on purpose: that one answers "what do our
 * customer agents cost", and HQ is internal tooling. Leaving it in inflated
 * every per-agent figure with our own spending, so the admin endpoints now
 * exclude it and this is where it lives.
 *
 * Reports both kinds of money together, because only one of them is in
 * llm_usage: tokens (Claude thinking, OpenAI voice) and images (Leonardo,
 * billed per picture). A page showing only tokens would understate the bill by
 * about half.
 */

import { useCallback, useEffect, useState } from 'react';

import { getHQUsage } from '../services/hqApi';
import type { HQUsage } from '../types';
import styles from './UsageScreen.module.css';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
];

const money = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

export function UsageScreen() {
  const [usage, setUsage] = useState<HQUsage | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((d: number) =>
    getHQUsage(d)
      .then(u => { setUsage(u); setError(null); })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load usage'))
      .finally(() => setLoading(false)),
  []);

  useEffect(() => { void load(days); }, [load, days]);

  const peak = usage ? Math.max(...usage.byDay.map(d => d.totalUsd), 0.01) : 1;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <div className={styles.headInner}>
          <span className={`hqEyebrow ${styles.eyebrow}`}>What HQ costs to run</span>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Spending</h1>
            <div className={styles.ranges}>
              {RANGES.map(r => (
                <button
                  key={r.days}
                  className={`hqGhostPill ${days === r.days ? 'hqOn' : ''}`}
                  onClick={() => setDays(r.days)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <p className={styles.subtitle}>
            Our own workers and tools — kept out of the per-agent page, which is about what we
            sell. Images are billed per picture and never appear in token usage, so both are here.
          </p>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.inner}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {loading && <div className={styles.loading}>Loading…</div>}

          {usage && (
            <>
              <div className={styles.totals}>
                <div className={`${styles.total} ${styles.totalBig}`}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={styles.totalValue}>{money(usage.totals.totalUsd)}</span>
                  <span className={styles.totalMeta}>last {usage.days} days</span>
                </div>
                <div className={styles.total}>
                  <span className={styles.totalLabel}>Images</span>
                  <span className={styles.totalValue}>{money(usage.totals.imagesUsd)}</span>
                  <span className={styles.totalMeta}>{usage.totals.imageCount} generated</span>
                </div>
                <div className={styles.total}>
                  <span className={styles.totalLabel}>Tokens</span>
                  <span className={styles.totalValue}>{money(usage.totals.tokensUsd)}</span>
                  <span className={styles.totalMeta}>{usage.totals.calls} calls</span>
                </div>
              </div>

              {usage.byDay.length > 0 && (
                <section className={styles.section}>
                  <span className="hqEyebrow">Day by day</span>
                  <div className={styles.chart}>
                    {usage.byDay.map(d => (
                      <div key={d.day} className={styles.bar} title={`${d.day} — ${money(d.totalUsd)}`}>
                        {/* Stacked so the shape of the spend is visible, not
                            just the height — images and tokens behave very
                            differently. */}
                        <div className={styles.barStack} style={{ height: `${(d.totalUsd / peak) * 100}%` }}>
                          <div className={styles.barImages} style={{ flexBasis: `${(d.imagesUsd / (d.totalUsd || 1)) * 100}%` }} />
                          <div className={styles.barTokens} style={{ flexBasis: `${(d.tokensUsd / (d.totalUsd || 1)) * 100}%` }} />
                        </div>
                        <span className={styles.barDay}>{d.day.slice(8)}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.legend}>
                    <span><i className={styles.keyImages} /> Images</span>
                    <span><i className={styles.keyTokens} /> Tokens</span>
                  </div>
                </section>
              )}

              {usage.byImageModel.length > 0 && (
                <section className={styles.section}>
                  <span className="hqEyebrow">Which model drew the pictures</span>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Model</th><th className={styles.num}>Pictures</th><th className={styles.num}>Each</th><th className={styles.num}>Cost</th></tr>
                    </thead>
                    <tbody>
                      {usage.byImageModel.map(r => (
                        <tr key={r.model}>
                          <td>{r.label}</td>
                          <td className={styles.num}>{r.n}</td>
                          <td className={styles.num}>{money(r.each)}</td>
                          <td className={styles.num}>{money(r.usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <section className={styles.section}>
                <span className="hqEyebrow">What the thinking and writing went on</span>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Purpose</th><th>Model</th><th className={styles.num}>Calls</th><th className={styles.num}>In</th><th className={styles.num}>Out</th><th className={styles.num}>Cost</th></tr>
                  </thead>
                  <tbody>
                    {usage.byProcess.map(r => (
                      <tr key={`${r.process}-${r.model}`}>
                        <td><span className={styles.tag}>{r.label}</span></td>
                        <td className={styles.model}>
                          <span className={styles.modelName}>{r.modelName}</span>
                          {r.modelName !== r.model && <span className={styles.modelId}>{r.model}</span>}
                        </td>
                        <td className={styles.num}>{r.calls}</td>
                        <td className={styles.num}>{compact(r.inp)}</td>
                        <td className={styles.num}>{compact(r.outp)}</td>
                        <td className={styles.num}>{money(r.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {usage.byWorker.length > 0 && (
                <section className={styles.section}>
                  <span className="hqEyebrow">Who spent it</span>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Worker</th><th>For</th><th>Model</th>
                        <th className={styles.num}>Count</th>
                        <th className={styles.num}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.byWorker.map(r => (
                        <tr key={`${r.who}-${r.model}-${r.kind}`}>
                          <td>{r.who}</td>
                          <td>
                            <span className={styles.tag}>
                              {r.kind === 'images' ? 'Pictures' : 'Thinking & writing'}
                            </span>
                          </td>
                          <td className={styles.model}>
                            <span className={styles.modelName}>{r.modelName}</span>
                            {r.modelName !== r.model && <span className={styles.modelId}>{r.model}</span>}
                          </td>
                          <td className={styles.num}>
                            {r.kind === 'images' ? `${r.pictures} pics` : `${r.calls} calls`}
                          </td>
                          <td className={styles.num}>{money(r.usd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              <section className={styles.section}>
                <span className="hqEyebrow">Most recent calls</span>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th><th>Worker</th><th>What for</th><th>Model</th>
                      <th className={styles.num}>Tokens</th>
                      <th className={styles.num}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recent.map(r => (
                      <tr key={r.key}>
                        <td className={styles.mono}>
                          {new Date(r.created_at).toLocaleString(undefined, {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td>{r.who}</td>
                        <td>
                          <span className={`${styles.tag} ${r.kind === 'images' ? styles.tagImage : ''}`}>
                            {r.label}
                          </span>
                          {/* A picture's subject is what identifies it; a token
                              call has nothing equivalent. */}
                          {r.title && <span className={styles.recentTitle} dir="auto">{r.title}</span>}
                        </td>
                        <td className={styles.model}>
                          <span className={styles.modelName}>{r.modelName}</span>
                          {r.modelName !== r.model && <span className={styles.modelId}>{r.model}</span>}
                        </td>
                        <td className={styles.num}>
                          {r.kind === 'images'
                            ? <span className={styles.dash}>—</span>
                            : `${compact(r.input_tokens || 0)} / ${compact(r.output_tokens || 0)}`}
                        </td>
                        <td className={styles.num}>{money(r.usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
