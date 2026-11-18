/**
 * ProtectionTab — Builder Admin → Data protection (task #986 P3).
 *
 * Every customer message the agent's data protection stopped, and how many
 * the customer reported as "blocked by mistake" — so the detectors can be
 * tuned. Never any text of a message: detector ids, where and when.
 *
 * Built from the LLM Usage tab's pieces (same stat cards, period select,
 * switch and tables — UsageTab.module.css). Data: GET
 * /api/agents/:slug/protection-events (server builder/services/
 * protectionEvents.js — the same report the MCP reads).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DETECTORS, resolveSettings } from '@protection/detectors.mjs';
import { fetchProtectionReport, type ProtectionReport } from '../../state/builderApi';
import type { AgentDoc } from '../../types';
import styles from './UsageTab.module.css';

const PERIODS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 365, label: 'Last year' },
];

const SURFACE_LABEL: Record<string, string> = {
  live: 'Customer chat', builder: 'Builder chat', simulation: 'Simulation', api: 'Other',
};

const nameOf = (id: string) => DETECTORS.find(d => d.id === id)?.name.en ?? id;
const int = (n: number) => n.toLocaleString('en-US');
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

type Show = 'all' | 'mistakes';

export function ProtectionTab({ agent }: { agent: AgentDoc }) {
  const slug = agent.slug;
  const [days, setDays] = useState(30);
  const [show, setShow] = useState<Show>('all');
  const [report, setReport] = useState<ProtectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    let cancelled = false;
    // Loading flag + fetch in one async step (no synchronous setState in the effect body).
    void (async () => {
      setLoading(true);
      try {
        const r = await fetchProtectionReport({ agentSlug: slug, days });
        if (!cancelled && id === reqId.current) { setReport(r); setError(null); }
      } catch (err) {
        if (!cancelled && id === reqId.current) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled && id === reqId.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, days]);

  // What runs now (the Builder's working copy of the agent) — one line, with
  // a link to where it is set.
  const settings = useMemo(() => resolveSettings(agent.dataProtection), [agent.dataProtection]);
  const exceptions = (agent.crews ?? []).filter(c => Object.keys(c.dataProtection?.detectors ?? {}).length > 0).length;

  const rows = useMemo(
    () => (report?.recent ?? []).filter(r => show === 'all' || r.mistakeReportedAt),
    [report, show],
  );

  const stats = report ? [
    { label: 'Blocked messages', value: int(report.total), note: `last ${report.days} days` },
    { label: 'Reported as a mistake', value: int(report.mistakes), note: `${pct(report.mistakes, report.total)} of blocks` },
    { label: 'Caught in the browser', value: int(report.bySide.client ?? 0), note: 'the text never left the device' },
    { label: 'Caught on the server', value: int(report.bySide.server ?? 0), note: 'not saved, no add-on ran' },
  ] : [];

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <div>
            <div className={styles.caption}>Lybi · {agent.name}</div>
            <h2 className={styles.title}>Data protection</h2>
            <div className={styles.caption}>
              {settings.enabled
                ? `On — checks ${settings.detectorIds.map(nameOf).join(', ') || 'nothing'}${exceptions ? ` · ${exceptions} crew exception${exceptions === 1 ? '' : 's'}` : ''}. `
                : 'Off for this agent. '}
              <Link className={styles.link} to={`/${slug}/builder`}>Settings in the agent's Setup</Link>
            </div>
          </div>
        </header>

        <div className={styles.stats}>
          {(stats.length ? stats : [
            { label: 'Blocked messages', value: '—', note: '' },
            { label: 'Reported as a mistake', value: '—', note: '' },
            { label: 'Caught in the browser', value: '—', note: '' },
            { label: 'Caught on the server', value: '—', note: '' },
          ]).map(s => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statNote}>{s.note}</div>
            </div>
          ))}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.switch} role="group" aria-label="Show">
            {(['all', 'mistakes'] as Show[]).map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={show === v}
                className={`${styles.switchBtn} ${show === v ? styles.switchOn : ''}`}
                onClick={() => setShow(v)}
              >
                {v === 'all' ? 'All blocks' : 'Reported as a mistake'}
              </button>
            ))}
          </div>
          <label className={styles.periodLabel}>
            Period
            <select className={`${styles.select} ${styles.periodSelect}`} value={days} onChange={e => setDays(Number(e.target.value))}>
              {PERIODS.map(p => <option key={p.days} value={p.days}>{p.label}</option>)}
            </select>
          </label>
        </div>

        <div className={`${styles.sheet} ${loading && report ? styles.dim : ''}`}>
          {error && <div className={`${styles.empty} ${styles.error}`}>Could not load the blocks: {error}</div>}
          {!error && !report && <div className={styles.empty}>Loading…</div>}
          {!error && report && report.total === 0 && (
            <div className={styles.empty}>No message was blocked in this period.</div>
          )}

          {!error && report && report.total > 0 && (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Detector</th>
                    <th className={styles.num}>Blocks</th>
                    <th className={styles.num} title="The customer tapped &quot;blocked by mistake&quot;">Reported as a mistake</th>
                    <th className={styles.num}>Mistake rate</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byDetector.map(d => (
                    <tr key={d.id}>
                      <td>{nameOf(d.id)}</td>
                      <td className={styles.num}>{int(d.blocks)}</td>
                      <td className={styles.num}>{int(d.mistakes)}</td>
                      <td className={styles.num}>{pct(d.mistakes, d.blocks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!error && report && report.total > 0 && (
          <div className={styles.sheet} style={{ marginTop: 16 }}>
            {rows.length === 0 ? (
              <div className={styles.empty}>No block was reported as a mistake in this period.</div>
            ) : (
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Detected</th>
                      <th>Caught</th>
                      <th>Where</th>
                      <th>Conversation</th>
                      <th>Reported as a mistake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.id}>
                        <td>{when(r.at)}</td>
                        <td>{r.detectors.map(nameOf).join(', ')}</td>
                        <td>{r.side === 'client' ? 'Browser' : 'Server'}</td>
                        <td>{SURFACE_LABEL[r.surface] ?? r.surface}</td>
                        <td>
                          {r.conversationId
                            ? <Link className={styles.link} to={`/${slug}/builder/admin/conversations?c=${r.conversationId}`}>#{r.conversationId}</Link>
                            : <span className={styles.sub} title="Blocked before the first message created a conversation">—</span>}
                        </td>
                        <td>{r.mistakeReportedAt ? when(r.mistakeReportedAt) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className={styles.foot}>
              Latest {int(rows.length)} shown. The text of a blocked message is never kept — only what was detected, where and when.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
