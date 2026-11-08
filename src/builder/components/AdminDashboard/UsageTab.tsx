/**
 * UsageTab — Builder Admin → LLM Usage (task #953).
 *
 * Every model call the agent made, two ways:
 *   - By runs: one row per call — crew, add-on (name + type), model,
 *     conversation + interaction, tokens, duration, estimated cost. This is
 *     what tells several Thinkers in one crew apart.
 *   - By conversations: the calls grouped by conversation id; a row opens
 *     into its calls split by interaction. Calls made outside a conversation
 *     are grouped as "Unlinked calls".
 * Filters (period, crew, add-on, model) drive the four cards and the table.
 *
 * Builder-only: the Aspect BI dashboard keeps the shared
 * components/dashboard/LLMUsagePage. Data: GET /api/llm-usage
 * (server builder/services/llmUsageReport.js — llm_usage joined with
 * addon_runs). Layout follows Noa's approved mockup for #953.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchLlmUsage,
  fetchLlmUsageConversation,
  type UsageConversation,
  type UsageInteraction,
  type UsageReport,
  type UsageRun,
} from '../../state/builderApi';
import styles from './UsageTab.module.css';

type View = 'runs' | 'conversations';

const PAGE = 100;
const UNLINKED = 'unlinked';

const PERIODS: { id: string; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'all', label: 'All time' },
];

const KIND_LABEL: Record<string, string> = {
  simulation: 'Simulation',
  'builder-preview': 'Builder chat',
  live: 'Customer',
  load_test: 'Load test',
};

// ─── Formatting ───────────────────────────────────────────────────────
const int = (n: number) => n.toLocaleString('en-US');

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** A call's cost — three decimals, the way the mockup reads. */
function rowCost(c: number | null): string {
  if (c == null) return '—';
  if (c > 0 && c < 0.001) return '<$0.001';
  return `$${c.toFixed(3)}`;
}

/** A total — cents once it is a dollar or more. */
function totalCost(c: number): string {
  if (c >= 1) return `$${c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (c > 0 && c < 0.001) return '<$0.001';
  return `$${c.toFixed(3)}`;
}

/** A group's cost: "—" when none of its calls has a price. */
function groupCost(t: { calls: number; cost: number; unpriced: number }): string {
  return t.unpriced > 0 && t.unpriced >= t.calls && t.cost === 0 ? '—' : totalCost(t.cost);
}

/** " · 3 web searches" — empty when none (task #967). */
function searchesNote(n: number | undefined): string {
  return n ? ` · ${int(n)} web search${n === 1 ? '' : 'es'}` : '';
}

function seconds(ms: number | null): string {
  if (ms == null) return '—';
  return ms >= 100_000 ? `${Math.round(ms / 1000)}s` : `${(ms / 1000).toFixed(1)}s`;
}

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });
const startedFmt = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const pickDayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

const isOneDay = (period: string) => period === 'today' || /^\d{4}-\d{2}-\d{2}$/.test(period);

function dayLabel(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : pickDayFmt.format(d);
}

// ─── The tables ───────────────────────────────────────────────────────
function RunTable({ runs, oneDay, nested, onOpenConversation }: {
  runs: UsageRun[];
  oneDay: boolean;
  nested?: boolean;
  onOpenConversation?: (id: string) => void;
}) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.colTime}>Time</th>
            <th>Crew</th>
            <th>Add-on / Type</th>
            <th>Model</th>
            {!nested && <th>Conversation</th>}
            <th className={styles.num}>Input / Output</th>
            <th className={styles.num}>Duration</th>
            <th className={styles.num}>Est. cost</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.id}>
              <td className={styles.colTime}>
                {!oneDay && <span className={styles.day}>{dayFmt.format(r.at)} ·</span>}
                {timeFmt.format(r.at)}
              </td>
              {r.addonScope === 'Agent level' ? (
                <td title="An agent-level add-on: it belongs to the agent and ran while this crew was active">
                  <span className={styles.crewName}>{r.crew || '—'}</span>
                  <span className={styles.sub}>via agent-level add-on</span>
                </td>
              ) : (
                <td className={styles.crew}>{r.crew || '—'}</td>
              )}
              <td>
                <span className={styles.addonName}>{r.addonName}</span>
                <span className={styles.sub}>{r.addonType}</span>
              </td>
              <td title={r.model}>{r.modelName}</td>
              {!nested && (
                <td>
                  {r.conversationId ? (
                    <>
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => onOpenConversation?.(r.conversationId!)}
                        title="Open this conversation's calls"
                      >
                        #{r.conversationId}
                      </button>
                      <span className={styles.sub}>{r.interaction != null ? `Interaction ${r.interaction}` : '—'}</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.unlinked}>Unlinked</span>
                      <span className={styles.sub}>Outside a conversation</span>
                    </>
                  )}
                </td>
              )}
              {r.kind === 'web_search' ? (
                <td className={styles.num} title="Web searches — about $0.01 each; the pages read are in the model call's input tokens">
                  {int(r.searches ?? 0)} search{r.searches === 1 ? '' : 'es'}
                </td>
              ) : (
                <td className={styles.num} title={`${int(r.input)} input · ${int(r.output)} output tokens`}>
                  {compact(r.input)} <span className={styles.slash}>/</span> {compact(r.output)}
                </td>
              )}
              <td className={styles.num}>{seconds(r.durationMs)}</td>
              <td className={styles.num} title={r.cost == null ? 'No known price for this model — not counted' : undefined}>
                {rowCost(r.cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversationDetail({ state, oneDay, linked }: {
  state: { loading: boolean; error?: string; interactions?: UsageInteraction[] } | undefined;
  oneDay: boolean;
  /** false = the unlinked calls. */
  linked: boolean;
}) {
  if (!state || (state.loading && !state.interactions)) {
    return <div className={styles.detailNote}>Loading calls…</div>;
  }
  if (state.error) return <div className={`${styles.detailNote} ${styles.error}`}>Could not load the calls: {state.error}</div>;
  const groups = state.interactions || [];
  if (!groups.length) return <div className={styles.detailNote}>No matching calls.</div>;
  return (
    <>
      {groups.map(g => (
        <div key={g.interaction ?? 0} className={styles.turnBlock}>
          <div className={styles.turn}>
            <span className={styles.turnTitle}>
              {g.interaction != null ? `Interaction ${g.interaction}` : linked ? 'Interaction unknown' : 'Outside a conversation'}
            </span>
            <span className={styles.turnMeta}>
              {int(g.calls)} call{g.calls === 1 ? '' : 's'}{searchesNote(g.searches)} · {compact(g.input)} / {compact(g.output)} tokens · {groupCost(g)}
              {g.unpriced > 0 && g.unpriced < g.calls && ` + ${g.unpriced} unpriced`}
            </span>
          </div>
          <div className={styles.nestedSheet}>
            <RunTable runs={g.runs} oneDay={oneDay} nested />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── The screen ───────────────────────────────────────────────────────
export function UsageTab({ agentSlug, agentName }: { agentSlug: string; agentName: string }) {
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'conversations' ? 'conversations' : 'runs';
  const period = params.get('period') || '30d';
  const crew = params.get('crew') ?? '';
  const addon = params.get('addon') ?? '';
  const model = params.get('model') ?? '';

  const setParam = useCallback((patch: Record<string, string | null>) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') next.delete(k); else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  const [report, setReport] = useState<UsageReport | null>(null);
  const [runs, setRuns] = useState<UsageRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [details, setDetails] = useState<Record<string, { loading: boolean; error?: string; interactions?: UsageInteraction[] }>>({});
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const reqId = useRef(0);

  const filters = useMemo(() => ({ agentSlug, period, crew, addon, model }), [agentSlug, period, crew, addon, model]);
  const filterKey = `${agentSlug}|${period}|${crew}|${addon}|${model}`;

  // Main read — on every filter / view change. The old data stays on
  // screen (dimmed) until the new answer arrives, so nothing jumps.
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    fetchLlmUsage({ ...filters, view, limit: PAGE })
      .then(res => {
        if (id !== reqId.current) return;
        setReport(res);
        setRuns(res.runs || []);
      })
      .catch(err => { if (id === reqId.current) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [filters, view]);

  // Filters changed → opened conversations' calls must be read again.
  const currentKey = useRef(filterKey);
  useEffect(() => { currentKey.current = filterKey; setDetails({}); }, [filterKey]);

  const loadDetail = useCallback((key: string) => {
    const asked = filterKey;
    const keep = () => currentKey.current === asked; // an answer for old filters is dropped
    setDetails(prev => ({ ...prev, [key]: { ...(prev[key] || {}), loading: true, error: undefined } }));
    fetchLlmUsageConversation({ ...filters, id: key })
      .then(interactions => { if (keep()) setDetails(prev => ({ ...prev, [key]: { loading: false, interactions } })); })
      .catch(err => { if (keep()) setDetails(prev => ({ ...prev, [key]: { loading: false, error: err instanceof Error ? err.message : String(err) } })); });
  }, [filters, filterKey]);

  // Every opened conversation has its calls (or is fetching them).
  useEffect(() => {
    if (view !== 'conversations') return;
    for (const key of opened) if (!details[key]) loadDetail(key);
  }, [view, opened, details, loadDetail]);

  // After a jump from the runs view, bring the conversation into sight.
  useEffect(() => {
    if (!scrollTo || view !== 'conversations' || loading) return;
    const el = document.getElementById(`usage-conv-${scrollTo}`);
    if (el) { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); setScrollTo(null); }
  }, [scrollTo, view, loading, report]);

  const toggle = (key: string) => setOpened(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const openConversation = (id: string) => {
    setOpened(prev => new Set(prev).add(id));
    setScrollTo(id);
    setParam({ view: 'conversations' });
  };

  const loadMore = () => {
    if (!report || loadingMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    fetchLlmUsage({ ...filters, view: 'runs', offset: runs.length, limit: PAGE })
      .then(res => { if (id === reqId.current) setRuns(prev => [...prev, ...(res.runs || [])]); })
      .catch(err => { if (id === reqId.current) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => setLoadingMore(false));
  };

  const options = report?.options;
  const summary = report?.summary;
  const oneDay = isOneDay(period);
  const anyFilter = !!(crew || addon || model);

  // Add-ons grouped by where they live; with a crew picked, only that crew's
  // and the agent-level ones (plus the picked one, so it never vanishes).
  const addonGroups = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof options>['addons']>();
    for (const a of options?.addons || []) {
      const scope = a.crew || 'Other';
      if (crew && scope !== crew && scope !== 'Agent level' && a.id !== addon) continue;
      (groups.get(scope) || groups.set(scope, []).get(scope)!).push(a);
    }
    return [...groups.entries()].sort((x, y) =>
      (x[0] === 'Agent level' ? 1 : 0) - (y[0] === 'Agent level' ? 1 : 0) || x[0].localeCompare(y[0]));
  }, [options, crew, addon]);

  const periodKnown = PERIODS.some(p => p.id === period) || (report?.days || []).some(d => d.day === period);

  const stats: { label: string; value: string; note?: string; title?: string }[] = [
    {
      label: 'Total calls',
      value: summary ? int(summary.calls) : '—',
      // Web searches (#967) are priced lines, not model calls — named here.
      note: summary?.searches ? `+ ${int(summary.searches)} web search${summary.searches === 1 ? '' : 'es'} (in the cost)` : undefined,
    },
    { label: 'Conversations', value: summary ? int(summary.conversations) : '—' },
    {
      label: 'Input / Output',
      value: summary ? `${compact(summary.input)} / ${compact(summary.output)}` : '—',
      title: summary ? `${int(summary.input)} input · ${int(summary.output)} output tokens` : undefined,
    },
    {
      label: 'Est. cost',
      value: summary ? totalCost(summary.cost) : '—',
      note: summary && summary.unpriced > 0
        ? `${int(summary.unpriced)} call${summary.unpriced === 1 ? '' : 's'} with no known price — not counted`
        : 'List prices, USD',
    },
  ];

  const total = report?.total ?? 0;
  const matching = summary?.calls ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <div>
            <div className={styles.caption}>Lybi · {agentName}</div>
            <h2 className={styles.title}>LLM Usage</h2>
            <div className={styles.caption}>Model calls, conversations and estimated cost</div>
          </div>
        </header>

        <div className={styles.stats}>
          {stats.map(s => (
            <div key={s.label} className={styles.stat}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statValue} title={s.title}>{s.value}</div>
              {s.note !== undefined && <div className={styles.statNote}>{s.note}</div>}
            </div>
          ))}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.switch} role="group" aria-label="View">
            {(['runs', 'conversations'] as View[]).map(v => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                className={`${styles.switchBtn} ${view === v ? styles.switchOn : ''}`}
                onClick={() => setParam({ view: v === 'runs' ? null : v })}
              >
                {v === 'runs' ? 'By runs' : 'By conversations'}
              </button>
            ))}
          </div>
          <label className={styles.periodLabel}>
            Period
            <select
              className={`${styles.select} ${styles.periodSelect}`}
              value={period}
              onChange={e => setParam({ period: e.target.value === '30d' ? null : e.target.value })}
            >
              {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              {!periodKnown && <option value={period}>{dayLabel(period)}</option>}
              {(report?.days || []).length > 0 && (
                <optgroup label="Days with calls">
                  {report!.days.map(d => (
                    <option key={d.day} value={d.day}>{dayLabel(d.day)} · {int(d.n)} calls</option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        </div>

        <div className={styles.filters}>
          <select className={styles.select} aria-label="Crew" value={crew} onChange={e => setParam({ crew: e.target.value || null })}>
            <option value="">All crews</option>
            {(options?.crews || []).map(c => (
              <option key={c.name} value={c.name}>{c.name || '(no crew)'}</option>
            ))}
            {crew && !(options?.crews || []).some(c => c.name === crew) && <option value={crew}>{crew}</option>}
          </select>
          <select className={`${styles.select} ${styles.addonSelect}`} aria-label="Add-on" value={addon} onChange={e => setParam({ addon: e.target.value || null })}>
            <option value="">All add-ons</option>
            {addonGroups.map(([scope, list]) => (
              <optgroup key={scope} label={scope}>
                {list.map(a => (
                  <option key={a.id} value={a.id}>{a.name === a.type ? a.name : `${a.name} · ${a.type}`}</option>
                ))}
              </optgroup>
            ))}
            {addon && !(options?.addons || []).some(a => a.id === addon) && <option value={addon}>{addon}</option>}
          </select>
          <select className={styles.select} aria-label="Model" value={model} onChange={e => setParam({ model: e.target.value || null })}>
            <option value="">All models</option>
            {(options?.models || []).map(m => (
              <option key={m.id} value={m.id}>{m.name}{m.priced ? '' : ' (no price)'}</option>
            ))}
            {model && !(options?.models || []).some(m => m.id === model) && <option value={model}>{model}</option>}
          </select>
          <span className={styles.count} aria-live="polite">
            {report ? `${int(matching)} matching call${matching === 1 ? '' : 's'}` : ''}
          </span>
          <button
            type="button"
            className={`${styles.clear} ${anyFilter ? '' : styles.hidden}`}
            onClick={() => setParam({ crew: null, addon: null, model: null })}
            tabIndex={anyFilter ? 0 : -1}
          >
            Clear filters
          </button>
        </div>

        <div className={`${styles.sheet} ${loading && report ? styles.dim : ''}`}>
          {error && <div className={`${styles.empty} ${styles.error}`}>Could not load the usage: {error}</div>}
          {!error && !report && <div className={styles.empty}>Loading…</div>}
          {!error && report && matching === 0 && (
            <div className={styles.empty}>No matching calls{anyFilter ? ' — try clearing the filters' : ' in this period'}.</div>
          )}

          {!error && report && matching > 0 && view === 'runs' && (
            <RunTable runs={runs} oneDay={oneDay} onOpenConversation={openConversation} />
          )}

          {!error && report && matching > 0 && view === 'conversations' && (
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Conversation ID</th>
                    <th>Started</th>
                    <th className={styles.num}>Interactions</th>
                    <th className={styles.num}>Calls</th>
                    <th className={styles.num}>Input / Output</th>
                    <th className={styles.num}>Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.conversations || []).map((c: UsageConversation) => {
                    const key = c.id ?? UNLINKED;
                    const isOpen = opened.has(key);
                    return (
                      <Fragment key={key}>
                        <tr id={`usage-conv-${key}`} className={`${styles.convRow} ${isOpen ? styles.convOpen : ''}`} onClick={() => toggle(key)}>
                          <td>
                            <button
                              type="button"
                              className={styles.link}
                              aria-expanded={isOpen}
                              onClick={e => { e.stopPropagation(); toggle(key); }}
                            >
                              <span className={styles.caret} aria-hidden>{isOpen ? '▾' : '▸'}</span>
                              {c.id ? `#${c.id}` : 'Unlinked calls'}
                            </button>
                            <span className={`${styles.sub} ${styles.subIndent}`}>
                              {c.id ? (KIND_LABEL[c.kind || ''] || 'Conversation') : 'Outside a conversation'}
                            </span>
                          </td>
                          <td>{c.id ? startedFmt.format(c.startedAt) : '—'}</td>
                          <td className={styles.num}>{c.interactions ?? '—'}</td>
                          <td className={styles.num} title={c.searches ? `${int(c.calls)} model calls${searchesNote(c.searches)}` : undefined}>
                            {int(c.calls)}{c.searches ? <span className={styles.sub}>{int(c.searches)} web search{c.searches === 1 ? '' : 'es'}</span> : null}
                          </td>
                          <td className={styles.num} title={`${int(c.input)} input · ${int(c.output)} output tokens`}>
                            {compact(c.input)} <span className={styles.slash}>/</span> {compact(c.output)}
                          </td>
                          <td className={styles.num} title={c.unpriced ? `${c.unpriced} call(s) with no known price — not counted` : undefined}>
                            {groupCost(c)}{c.unpriced > 0 && c.unpriced < c.calls && <span className={styles.unpricedMark}>*</span>}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className={styles.detailRow}>
                            <td colSpan={6}>
                              <div className={styles.detail}>
                                <ConversationDetail state={details[key]} oneDay={oneDay} linked={!!c.id} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {report && matching > 0 && (
            <div className={styles.foot}>
              <span>
                {view === 'runs'
                  ? `${int(Math.min(runs.length, total))} of ${int(total)} calls · newest first`
                  : `${int((report.conversations || []).filter(c => c.id).length)} conversations`}
                {report.capped ? ' · only the newest 20,000 calls of this period' : ''}
              </span>
              {view === 'runs' && runs.length < total ? (
                <button type="button" className={styles.more} onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : `Show ${int(Math.min(PAGE, total - runs.length))} more`}
                </button>
              ) : (
                <span>USD · estimated at list price</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
