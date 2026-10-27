/**
 * Admin → Conversations (tasks #922, #917, #924) — this agent only.
 *
 * 1. The LIST: one row per conversation — its unique id (#924), start, kind
 *    (External · Builder · Simulated), user, messages, last activity, and an
 *    "Open in Builder" button. Search by id or user, a last-activity range,
 *    the kind with counts, 50 a page. State lives in the URL, so "back"
 *    returns to the same list.
 * 2. The CONVERSATION READER: what the agent did, turn by turn.
 *    - Left: the conversation in TURNS. A turn = the user's message → the
 *      chain reaction it set off → the reply → steps that ran after the
 *      reply. Each message keeps its own direction (#917).
 *    - Right: the selected turn's CHAIN — every add-on in order, parallel
 *      steps grouped, one line each of what it concluded; open a step for
 *      its output, raw answer, input and what it wrote.
 *    - Optional: "Agent's view after turn N" — the profile and thinking at
 *      that point, replayed from the steps' writes, with what was new.
 *    - Bottom: a turn strip with crew changes and failures marked.
 *    "Open in Builder" in the header; layers switch on and off.
 *
 * `?c=<id>` opens a conversation (Admin → Errors uses it), `&turn=<n>` a turn.
 * Designed with Leonardo: lybi-website/art-source/ui/conversation-reader/
 * (round 2: Reaction Rail + "evolved from the pick"). Data:
 * builder/routes/adminConversationsRoute.js.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchConversationMessages,
  fetchRunsForMessage,
  getAddonRun,
  getConversationOverview,
  listConversationPage,
  type ConversationMessage,
  type ConversationOverview,
  type ConversationPage,
  type ConversationRunSummary,
  type ConversationSource,
  type PersistedAddonRun,
} from '../../state/builderApi';
import { formatDuration } from '../../formatDuration';
import { ExportConversationModal } from '../ChatPanel/ExportConversationModal';
import { MarkdownBody } from '../ChatPanel/MarkdownBody';
import styles from './ConversationsTab.module.css';
import s from './AdminConversations.module.css';

interface Props {
  agentSlug: string;
  /** When set, list only this owner's conversations (Users drill-down). */
  userId?: number;
  /** When set, render a "← Back to users" link above the list. */
  backHref?: string;
}

const SOURCE_LABEL: Record<ConversationSource, string> = { live: 'External', builder: 'Builder', simulation: 'Simulated' };
const SOURCES: ConversationSource[] = ['live', 'builder', 'simulation'];
const RANGES = { all: 'Any time', today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' } as const;
type Range = keyof typeof RANGES;
const PAGE = 50;

const builderHref = (agentSlug: string, id: number) => `/${agentSlug}/builder?c=${id}`;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d < 31 ? `${d} day${d === 1 ? '' : 's'} ago` : fmtDate(iso);
}

function rangeDates(range: Range): { from?: string } {
  if (range === 'all') return {};
  const d = new Date();
  if (range === '7d') d.setDate(d.getDate() - 6);
  if (range === '30d') d.setDate(d.getDate() - 29);
  return { from: d.toISOString().slice(0, 10) };
}

export function ConversationsTab({ agentSlug, userId, backHref }: Props) {
  const [params, setParams] = useSearchParams();
  const openId = Number(params.get('c'));
  const update = useCallback((patch: Record<string, string | null>) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === '') next.delete(k); else next.set(k, v);
      }
      return next;
    });
  }, [setParams]);

  if (Number.isInteger(openId) && openId > 0) {
    const turnParam = params.get('turn');
    return (
      <ConversationReader
        agentSlug={agentSlug}
        conversationId={openId}
        turn={turnParam === null ? null : Number(turnParam)}
        onTurn={t => update({ turn: String(t) })}
        onBack={() => update({ c: null, turn: null })}
      />
    );
  }
  return <ConversationList agentSlug={agentSlug} userId={userId} backHref={backHref} params={params} update={update} />;
}

// ─── 1. The list ───────────────────────────────────────────────────

function ConversationList({ agentSlug, userId, backHref, params, update }: Props & {
  params: URLSearchParams;
  update: (patch: Record<string, string | null>) => void;
}) {
  const q = params.get('q') || '';
  const range = (params.get('range') as Range) in RANGES ? (params.get('range') as Range) : 'all';
  const source = SOURCES.includes(params.get('source') as ConversationSource) ? (params.get('source') as ConversationSource) : undefined;
  const page = Math.max(Number(params.get('page')) || 1, 1);

  const [typed, setTyped] = useState(q);
  const [loaded, setLoaded] = useState<{ key: string; data: ConversationPage } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Typing settles for a moment before it becomes the search.
  useEffect(() => {
    if (typed === q) return;
    const t = setTimeout(() => update({ q: typed.trim() || null, page: null }), 350);
    return () => clearTimeout(t);
  }, [typed, q, update]);

  const requestKey = [agentSlug, q, source, userId, range, page, tick].join('|');
  useEffect(() => {
    let cancelled = false;
    listConversationPage({ agentSlug, q, source, userId, ...rangeDates(range), limit: PAGE, offset: (page - 1) * PAGE })
      .then(d => { if (!cancelled) { setLoaded({ key: requestKey, data: d }); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [agentSlug, q, source, userId, range, page, requestKey]);
  // Keep the last page on screen while the next one loads — no flicker, no jump.
  const data = loaded?.data ?? null;
  const loading = loaded?.key !== requestKey;

  const counts = data?.counts ?? { all: 0, live: 0, builder: 0, simulation: 0 };
  const pages = Math.max(Math.ceil((data?.total ?? 0) / PAGE), 1);

  return (
    <div className={s.listScreen}>
      {backHref && <Link to={backHref} className={s.backLink}>← Back to users</Link>}
      <div className={s.titleRow}>
        <h2 className={s.title}>{userId ? 'User conversations' : 'Conversations'}</h2>
        <button type="button" className={s.iconBtn} onClick={() => setTick(n => n + 1)} title="Refresh" disabled={loading}>↻</button>
      </div>

      <div className={s.filters}>
        <input
          className={s.search}
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder="Conversation ID or user"
          aria-label="Search by conversation ID or user"
        />
        <select className={s.select} value={range} onChange={e => update({ range: e.target.value === 'all' ? null : e.target.value, page: null })}
          aria-label="Last activity">
          {(Object.keys(RANGES) as Range[]).map(r => <option key={r} value={r}>{RANGES[r]}</option>)}
        </select>
        <div className={s.segments} role="tablist" aria-label="Kind">
          <button type="button" role="tab" aria-selected={!source} className={`${s.segment} ${!source ? s.segmentOn : ''}`}
            onClick={() => update({ source: null, page: null })}>
            All <span className={s.count}>{counts.all}</span>
          </button>
          {SOURCES.map(k => (
            <button key={k} type="button" role="tab" aria-selected={source === k}
              className={`${s.segment} ${source === k ? s.segmentOn : ''}`} onClick={() => update({ source: k, page: null })}>
              <span className={`${s.dot} ${s[`dot_${k}`]}`} aria-hidden />{SOURCE_LABEL[k]} <span className={s.count}>{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      <div className={s.tableCard}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>ID</th><th>Started</th><th>Kind</th><th>User</th>
              <th className={s.num}>Messages</th><th>Last update</th><th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {(data?.conversations ?? []).map(c => (
              <tr key={c.id} className={s.tr} onClick={() => update({ c: String(c.id) })} tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') update({ c: String(c.id) }); }}>
                <td>
                  <div className={s.idCell}>#{c.id}</div>
                  {c.name && <div className={s.subName} dir="auto">{c.name}</div>}
                </td>
                <td className={s.nowrap}>{fmtDate(c.createdAt)}</td>
                <td>{c.source ? <span className={`${s.pill} ${s[`pill_${c.source}`]}`}>{SOURCE_LABEL[c.source]}</span> : <span className={s.muted}>—</span>}</td>
                <td className={s.userCell} title={c.ownerUserId || ''}>{c.simulatedBy || c.ownerName || c.ownerUserId || '—'}</td>
                <td className={s.num}>{c.messageCount}</td>
                <td className={s.nowrap} title={fmtDate(c.updatedAt)}>{ago(c.updatedAt)}</td>
                <td className={s.rowActions}>
                  <Link to={builderHref(agentSlug, c.id)} className={s.builderLink} onClick={e => e.stopPropagation()}
                    title="Open this conversation in the Builder">Open in Builder ↗</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.conversations.length === 0 && !loading && (
          <div className={s.empty}>No conversations match.</div>
        )}
        <div className={s.pager}>
          <span className={s.muted}>
            {data && data.total > 0 ? `Showing ${(page - 1) * PAGE + 1}–${Math.min(page * PAGE, data.total)} of ${data.total}` : loading ? 'Loading…' : ''}
          </span>
          <button type="button" className={s.pageBtn} disabled={page <= 1} onClick={() => update({ page: page - 1 > 1 ? String(page - 1) : null })}>‹</button>
          <span className={s.pageNum}>{page} / {pages}</span>
          <button type="button" className={s.pageBtn} disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>›</button>
        </div>
      </div>
    </div>
  );
}

// ─── 2. The conversation reader ────────────────────────────────────

interface Turn {
  /** 0 = the agent spoke before the user did (an opening / proactive message). */
  n: number;
  user: ConversationMessage | null;
  replies: ConversationMessage[];
  before: ConversationRunSummary[];
  after: ConversationRunSummary[];
  failed: number;
  moved: string | null;
  /** The crew that handled this turn (the one whose talker answered). */
  crew: string | null;
  ms: number;
}

const isAfter = (r: ConversationRunSummary) => r.lane === 'offline' || r.lane === 'background';
const isBad = (r: ConversationRunSummary) => r.status === 'error' || !!r.error;

function buildTurns(messages: ConversationMessage[], runs: ConversationRunSummary[]): Turn[] {
  const turns: Turn[] = [];
  let cur: Turn | null = null;
  for (const m of messages) {
    if (m.role === 'user') {
      cur = { n: 0, user: m, replies: [], before: [], after: [], failed: 0, moved: null, crew: null, ms: 0 };
      turns.push(cur);
    } else if (m.role === 'assistant') {
      if (!cur) { cur = { n: 0, user: null, replies: [], before: [], after: [], failed: 0, moved: null, crew: null, ms: 0 }; turns.push(cur); }
      cur.replies.push(m);
    }
  }
  // Number the user turns 1..N (an opening turn stays 0), as the server does.
  let k = 0;
  for (const t of turns) if (t.user) t.n = ++k;
  const byTurn = new Map(turns.map(t => [t.n, t]));
  const ends = new Map<number, number>();
  for (const r of runs) {
    const t = byTurn.get(r.turn ?? -1);
    if (!t) continue;
    (isAfter(r) ? t.after : t.before).push(r);
    if (isBad(r)) t.failed += 1;
    if (r.transitionTo) t.moved = r.transitionTo;
    if (!isAfter(r) && r.durationMs != null) {
      ends.set(t.n, Math.max(ends.get(t.n) ?? 0, new Date(r.startedAt).getTime() + r.durationMs));
    }
  }
  let prev: Turn | null = null;
  for (const t of turns) {
    const first = t.before[0];
    const end = ends.get(t.n);
    t.ms = first && end ? end - new Date(first.startedAt).getTime() : 0;
    // The crew the turn started in (its first crew step; else where the last turn left off)…
    const own = t.before.find(r => r.crewName) ?? t.after.find(r => r.crewName);
    t.crew = own?.crewName ?? prev?.moved ?? prev?.crew ?? null;
    // …and, only when different, the crew it ended in.
    if (t.moved === t.crew) t.moved = null;
    prev = t;
  }
  return turns;
}

const LAYER_KEY = 'builder:readerLayers';
function loadLayers(): { chain: boolean; view: boolean } {
  try { return { chain: true, view: true, ...JSON.parse(localStorage.getItem(LAYER_KEY) || '{}') }; } catch { return { chain: true, view: true }; }
}

type ColKey = 'conv' | 'chain' | 'view';
const RATIO_KEY = 'builder:readerColumns';
const DEFAULT_RATIO: Record<ColKey, number> = { conv: 1, chain: 1.45, view: 1.15 };
const COL_MIN = 280;
function loadRatio(): Record<ColKey, number> {
  try { return { ...DEFAULT_RATIO, ...JSON.parse(localStorage.getItem(RATIO_KEY) || '{}') }; } catch { return { ...DEFAULT_RATIO }; }
}
const isDefaultRatio = (r: Record<ColKey, number>) => (Object.keys(DEFAULT_RATIO) as ColKey[]).every(k => Math.abs(r[k] - DEFAULT_RATIO[k]) < 0.001);

function ConversationReader({ agentSlug, conversationId, turn, onTurn, onBack }: {
  agentSlug: string;
  conversationId: number;
  turn: number | null;
  onTurn: (t: number) => void;
  onBack: () => void;
}) {
  const [loaded, setLoaded] = useState<{ id: number; overview: ConversationOverview; messages: ConversationMessage[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [layers, setLayers] = useState(loadLayers);
  const toggle = (k: 'chain' | 'view') => setLayers(prev => {
    const next = { ...prev, [k]: !prev[k] };
    try { localStorage.setItem(LAYER_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    return next;
  });

  // Column widths — drag a divider to change the ratio; double-click it (or Reset columns) to restore.
  const [ratio, setRatio] = useState(loadRatio);
  const [dragging, setDragging] = useState<ColKey | null>(null);
  const colRefs = useRef<Partial<Record<ColKey, HTMLElement | null>>>({});
  const persistRatio = (r: Record<ColKey, number>) => {
    setRatio(r);
    try { if (isDefaultRatio(r)) localStorage.removeItem(RATIO_KEY); else localStorage.setItem(RATIO_KEY, JSON.stringify(r)); } catch { /* private mode */ }
  };
  const visible: ColKey[] = ['conv', ...(layers.chain ? ['chain' as const] : []), ...(layers.view ? ['view' as const] : [])];
  const startDrag = (a: ColKey, b: ColKey) => (e: React.PointerEvent) => {
    const ea = colRefs.current[a], eb = colRefs.current[b];
    if (!ea || !eb) return;
    e.preventDefault();
    const wa = ea.getBoundingClientRect().width, wb = eb.getBoundingClientRect().width;
    const sum = ratio[a] + ratio[b], x0 = e.clientX;
    let latest = ratio;
    const move = (ev: PointerEvent) => {
      const na = Math.min(Math.max(wa + ev.clientX - x0, COL_MIN), wa + wb - COL_MIN);
      latest = { ...ratio, [a]: (na / (wa + wb)) * sum, [b]: ((wa + wb - na) / (wa + wb)) * sum };
      setRatio(latest);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      setDragging(null);
      persistRatio(latest);
    };
    document.body.style.userSelect = 'none';
    setDragging(a);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const splitter = (a: ColKey, b: ColKey) => (
    <div role="separator" aria-orientation="vertical" aria-label="Resize columns"
      className={`${s.splitter} ${dragging === a ? s.splitterOn : ''}`}
      onPointerDown={startDrag(a, b)} onDoubleClick={() => persistRatio({ ...DEFAULT_RATIO })}
      title="Drag to resize · double-click to reset" />
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([getConversationOverview({ agentSlug, conversationId }), fetchConversationMessages({ agentSlug, conversationId })])
      .then(([overview, messages]) => { if (!cancelled) { setLoaded({ id: conversationId, overview, messages }); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [agentSlug, conversationId]);

  const data = loaded?.id === conversationId ? loaded : null;
  const turns = useMemo(() => (data ? buildTurns(data.messages, data.overview.runs) : []), [data]);
  const selected = turns.find(t => t.n === turn) ?? turns.find(t => t.user) ?? turns[0] ?? null;
  const idx = selected ? turns.indexOf(selected) : -1;
  const lastUserTurn = turns.reduce((m, t) => Math.max(m, t.n), 0);

  // Bring the selected turn into view when it is chosen from the rail or the strip.
  const turnRefs = useRef(new Map<number, HTMLDivElement>());
  // …and once when the conversation opens on a given turn (a shared link).
  const scrolledFor = useRef<number | null>(null);
  useEffect(() => {
    if (!data || turn === null || scrolledFor.current === conversationId) return;
    scrolledFor.current = conversationId;
    requestAnimationFrame(() => turnRefs.current.get(turn)?.scrollIntoView({ block: 'start' }));
  }, [data, turn, conversationId]);
  const go = (n: number) => {
    onTurn(n);
    requestAnimationFrame(() => turnRefs.current.get(n)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  const c = data?.overview.conversation;
  const who = c ? (c.simulatedBy || c.ownerName || c.ownerUserId) : null;

  return (
    <div className={s.reader}>
      <header className={s.readerHead}>
        <button type="button" className={s.backLink} onClick={onBack}>← Conversations</button>
        <div className={s.convTitleRow}>
          <span className={s.convId}>#{conversationId}</span>
          {c?.name && <span className={s.convName} dir="auto">{c.name}</span>}
          {c?.source && <span className={`${s.pill} ${s[`pill_${c.source}`]}`}>{SOURCE_LABEL[c.source]}</span>}
          <span className={s.facts}>
            {c ? [who, fmtDate(c.createdAt), `${lastUserTurn} turn${lastUserTurn === 1 ? '' : 's'}`, c.crewName ? `now in ${c.crewName}` : null].filter(Boolean).join(' · ') : (error || 'Loading…')}
          </span>
          <span className={s.spacer} />
          <div className={s.layerToggles} role="group" aria-label="Show">
            <button type="button" aria-pressed={layers.chain} className={`${s.layerBtn} ${layers.chain ? s.layerOn : ''}`} onClick={() => toggle('chain')}>
              {layers.chain ? '✓ ' : ''}Chain reaction
            </button>
            <button type="button" aria-pressed={layers.view} className={`${s.layerBtn} ${layers.view ? s.layerOn : ''}`} onClick={() => toggle('view')}>
              {layers.view ? '✓ ' : ''}Agent's view
            </button>
          </div>
          <button type="button" className={s.layerBtn} disabled={isDefaultRatio(ratio)} onClick={() => persistRatio({ ...DEFAULT_RATIO })}
            title="Put the columns back to their default widths">⟲ Reset columns</button>
          <Link to={builderHref(agentSlug, conversationId)} className={s.primaryBtn} title="Open this conversation in the Builder">Open in Builder ↗</Link>
          <button type="button" className={s.exportBtn} onClick={() => setExportOpen(true)}
            title="Download or copy this conversation as JSON — to hand to an AI for analysis">⤓ Export</button>
        </div>
      </header>

      <div className={`${s.readerBody} ${layers.chain ? '' : s.noChain} ${layers.view ? '' : s.noView}`}
        style={visible.length > 1 ? { gridTemplateColumns: visible.map(k => `minmax(${COL_MIN}px, ${ratio[k]}fr)`).join(' 14px ') } : undefined}>
        <section className={s.convCol} aria-label="Conversation" ref={el => { colRefs.current.conv = el; }}>
          {!data && <div className={styles.detailEmpty}>{error || 'Loading the conversation…'}</div>}
          {data && turns.length === 0 && <div className={styles.detailEmpty}>No messages in this conversation.</div>}
          {turns.map(t => (
            <TurnBlock
              key={t.n}
              turn={t}
              selected={t === selected}
              onSelect={() => onTurn(t.n)}
              setRef={el => { if (el) turnRefs.current.set(t.n, el); else turnRefs.current.delete(t.n); }}
            />
          ))}
        </section>

        {layers.chain && splitter('conv', 'chain')}
        {layers.chain && (
          <section className={s.chainCol} aria-label="Chain reaction" ref={el => { colRefs.current.chain = el; }}>
            {selected ? (
              <ChainRail
                key={selected.n}
                agentSlug={agentSlug}
                turn={selected}
                canPrev={idx > 0}
                canNext={idx >= 0 && idx < turns.length - 1}
                onPrev={() => idx > 0 && go(turns[idx - 1].n)}
                onNext={() => idx < turns.length - 1 && go(turns[idx + 1].n)}
                total={lastUserTurn}
              />
            ) : <div className={styles.detailEmpty}>Pick a turn.</div>}
          </section>
        )}

        {layers.view && splitter(layers.chain ? 'chain' : 'conv', 'view')}
        {layers.view && (
          <aside className={s.viewCol} aria-label="Agent's view" ref={el => { colRefs.current.view = el; }}>
            {data && selected ? <AgentView overview={data.overview} turn={selected.n} /> : null}
          </aside>
        )}
      </div>

      {turns.length > 0 && (
        <nav className={s.strip} aria-label="All turns">
          <span className={s.stripTitle}>All turns</span>
          <div className={s.stripTrack}>
            {turns.map((t, i) => (
              <div key={t.n} className={s.stripItem}>
                {i > 0 && <span className={s.stripArrow} aria-hidden>→</span>}
                <button type="button" className={`${s.stripTurn} ${t === selected ? s.stripOn : ''} ${t.failed ? s.stripBad : ''}`}
                  onClick={() => go(t.n)} title={t.user?.content || 'Opening message'}>
                  <span className={s.stripNum}>
                    <span aria-hidden>{t.user ? '👤' : '🤖'}</span> {t.n === 0 ? 'Opening' : `Turn ${t.n}`}
                    <span className={s.muted}>{fmtTime((t.user || t.replies[0])?.createdAt || '')}</span>
                  </span>
                  <span className={s.stripCrew}>
                    <span className={s.stripCrewName} dir="auto">👥 {t.crew || '—'}</span>
                    {t.moved && <span className={s.stripMove}>→ {t.moved}</span>}
                  </span>
                  <span className={s.stripSteps} title={`${t.before.length + t.after.length} steps`}>
                    {[...t.before, ...t.after].map(r => (
                      <i key={r.id} className={`${s.miniDot} ${isBad(r) ? s.stepDotBad : r.status === 'skipped' ? s.stepDotSkip : s.stepDotOk}`} />
                    ))}
                    <span className={s.stripCount}>{t.before.length + t.after.length} steps{t.failed ? ` · ${t.failed} failed` : ''}</span>
                  </span>
                </button>
              </div>
            ))}
          </div>
          <span className={s.legend}>
            <span><i className={`${s.lgDot} ${s.stepDotOk}`} />Done</span>
            <span><i className={`${s.lgDot} ${s.stepDotBad}`} />Failed</span>
            <span><i className={`${s.lgDot} ${s.stepDotSkip}`} />Skipped</span>
          </span>
        </nav>
      )}

      <ExportConversationModal open={exportOpen} onClose={() => setExportOpen(false)} agentSlug={agentSlug} conversationId={conversationId} />
    </div>
  );
}

/**
 * One turn in the conversation column: just the messages — the user's and
 * the agent's. Its chain reaction lives in the middle column; the turn's
 * number and its highlight tie the two together.
 */
function TurnBlock({ turn, selected, onSelect, setRef }: {
  turn: Turn;
  selected: boolean;
  onSelect: () => void;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={setRef} className={`${s.turn} ${selected ? s.turnOn : ''}`} onClick={onSelect}
      role="button" tabIndex={0} aria-pressed={selected} title={selected ? undefined : 'Show this turn\'s chain reaction'}
      onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onSelect(); }}>
      <div className={s.turnHead}>
        <span className={s.turnNum}>{turn.n === 0 ? '·' : turn.n}</span>
        <span className={s.turnNo}>{turn.n === 0 ? 'Opening' : `Turn ${turn.n}`}</span>
        {turn.crew && <span className={s.crewChip} title="The crew this turn started in">👥 {turn.crew}</span>}
        {turn.failed > 0 && <span className={s.turnBad}>{turn.failed} step{turn.failed === 1 ? '' : 's'} failed</span>}
        {turn.moved && <span className={s.moveChip}>→ {turn.moved}</span>}
      </div>
      {turn.user && (
        <div className={s.msgRow}>
          <div className={s.msgWho}><span className={s.whoIcon} aria-hidden>👤</span>User<span className={s.msgTime}>{fmtClock(turn.user.createdAt)}</span></div>
          <div className={`${s.bubble} ${s.bubbleUser}`} dir="auto">{turn.user.content}</div>
        </div>
      )}
      {turn.replies.map(m => (
        <div key={m.id} className={s.msgRow}>
          <div className={s.msgWho}><span className={s.whoIcon} aria-hidden>🤖</span>Agent<span className={s.msgTime}>{fmtClock(m.createdAt)}</span></div>
          <div className={`${s.bubble} ${s.bubbleBot}`} dir="auto"><MarkdownBody text={m.content || ''} /></div>
        </div>
      ))}
    </div>
  );
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── The chain ─────────────────────────────────────────────────────

/** Each add-on type as the Builder shows it — same emoji (builder/addons/*.addon.json). */
const TYPES: Record<string, { label: string; icon: string; tone: string }> = {
  'field-extractor':   { label: 'Field extractor', icon: '📥', tone: 'blue' },
  'field-interviewer': { label: 'Field interviewer', icon: '🎤', tone: 'blue' },
  'field-reasoner':    { label: 'Field reasoner', icon: '🧠', tone: 'blue' },
  'vibe-extractor':    { label: 'Vibe extractor', icon: '🧐', tone: 'blue' },
  thinker:             { label: 'Thinker', icon: '💭', tone: 'violet' },
  rules:               { label: 'Rules', icon: '⚖️', tone: 'amber' },
  'kb-retriever':      { label: 'KB retriever', icon: '📚', tone: 'teal' },
  'transition-router': { label: 'Transition router', icon: '🔀', tone: 'indigo' },
  talker:              { label: 'Talker', icon: '💬', tone: 'purple' },
  summarizer:          { label: 'Summarizer', icon: '📝', tone: 'gray' },
  'live-brain-panel':  { label: 'Live Brain', icon: '🧠', tone: 'gray' },
  'profiler-panel':    { label: 'Profiler', icon: '👤', tone: 'gray' },
};
const typeOf = (pluginId: string) => TYPES[pluginId] || { label: humanize(pluginId), icon: '🧩', tone: 'gray' };

function statusOf(run: ConversationRunSummary): { label: string; cls: string } {
  if (run.error?.code === 'output_cut_off') return { label: 'Cut off', cls: s.st_bad };
  if (isBad(run)) return { label: 'Failed', cls: s.st_bad };
  if (run.status === 'skipped') return { label: 'Skipped', cls: s.st_skip };
  if (run.status === 'running') return { label: 'Running', cls: s.st_skip };
  return { label: 'Done', cls: s.st_ok };
}

const clipText = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function ChainRail({ agentSlug, turn, canPrev, canNext, onPrev, onNext, total }: {
  agentSlug: string;
  turn: Turn;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  total: number;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const before = turn.before.map((r, i) => ({ r, n: i + 1 }));
  const after = turn.after.map((r, i) => ({ r, n: before.length + i + 1 }));
  // Consecutive steps with the same group number ran in parallel.
  const groups: { key: number; items: { r: ConversationRunSummary; n: number }[] }[] = [];
  for (const it of before) {
    const last = groups[groups.length - 1];
    if (last && last.key === it.r.group) last.items.push(it); else groups.push({ key: it.r.group, items: [it] });
  }
  const toggleStep = (id: string) => setOpen(o => (o === id ? null : id));
  const talkerId = [...turn.before].reverse().find(r => r.pluginId === 'talker')?.id ?? null;
  const replyCards = turn.replies.map(m => (
    <div key={m.id} className={s.replyCard}>
      <span className={s.replyLabel}>Agent reply</span>
      <div className={s.replyText} dir="auto"><MarkdownBody text={m.content || ''} /></div>
    </div>
  ));
  const row = ({ r, n }: { r: ConversationRunSummary; n: number }) => (
    <StepRow key={r.id} agentSlug={agentSlug} run={r} num={n} open={open === r.id} onToggle={() => toggleStep(r.id)} />
  );

  return (
    <div className={s.rail}>
      <div className={s.railHead}>
        <div className={s.railTitle}>
          Agent chain for {turn.n === 0 ? 'the opening' : `turn ${turn.n}`}
          {turn.crew && <span className={s.crewChip} title="The crew this turn started in">👥 {turn.crew}</span>}
          {turn.moved && <span className={s.moveChip} title="The crew it ended in">→ {turn.moved}</span>}
        </div>
        {turn.ms > 0 && <span className={s.railTime}>⏱ Total time {formatDuration(turn.ms)}</span>}
        <div className={s.railNav}>
          <button type="button" className={s.pageBtn} disabled={!canPrev} onClick={onPrev} aria-label="Previous turn">‹</button>
          <span className={s.muted}>{turn.n} / {total}</span>
          <button type="button" className={s.pageBtn} disabled={!canNext} onClick={onNext} aria-label="Next turn">›</button>
        </div>
      </div>
      {turn.user && (
        <div className={s.trigger}>
          <span className={s.triggerLabel}>👤 Set off by the user's message</span>
          <span className={s.triggerText} dir="auto">{turn.user.content}</span>
        </div>
      )}

      <div className={s.timeline}>
        {groups.length === 0 && <div className={s.muted}>No steps ran before the reply.</div>}
        {groups.map(g => (
          <div key={g.key} className={g.items.length > 1 ? s.parallel : undefined}>
            {g.items.length > 1 && <div className={s.parallelLabel}>⇉ Ran in parallel</div>}
            {g.items.map(it => (
              <div key={it.r.id}>
                {row(it)}
                {it.r.id === talkerId && <div className={s.replyWrap}>{replyCards}</div>}
              </div>
            ))}
          </div>
        ))}
        {!talkerId && replyCards.length > 0 && <div className={s.replyWrap}>{replyCards}</div>}
      </div>

      {after.length > 0 && (
        <div className={s.afterZone}>
          <div className={s.afterTitle}>✦ After the reply <span className={s.muted}>— background steps that enrich the profile</span></div>
          <div className={s.timeline}>{after.map(row)}</div>
        </div>
      )}
    </div>
  );
}

/** One add-on as a row: what it is · what it concluded · which fields it filled. */
function StepRow({ agentSlug, run, num, open, onToggle }: {
  agentSlug: string;
  run: ConversationRunSummary;
  num: number;
  open: boolean;
  onToggle: () => void;
}) {
  const type = typeOf(run.pluginId);
  const status = statusOf(run);
  const fields = run.writes.filter(w => w.kind !== 'thinking' && w.value !== null && w.value !== undefined && w.value !== '');
  // Thinkers save their judgement to the agent's thinking (by area), not to profile fields.
  const thinking = [...run.writes.filter(w => w.kind === 'thinking' && w.field)
    .reduce((m, w) => m.set(w.domain || 'thinking', (m.get(w.domain || 'thinking') || 0) + 1), new Map<string, number>())];
  const bad = isBad(run);
  return (
    <div className={`${s.stepWrap} ${open ? s.stepWrapOpen : ''}`}>
      <span className={`${s.dotNum} ${bad ? s.dotNumBad : run.status === 'skipped' ? s.dotNumSkip : ''}`}>{num}</span>
      <div className={`${s.stepCard} ${run.status === 'skipped' ? s.stepCardSkip : ''} ${bad ? s.stepCardBad : ''}`}>
        <button type="button" className={s.stepGrid} onClick={onToggle} aria-expanded={open}
          title={open ? 'Close' : 'Open everything this step did'}>
          <span className={s.colWho}>
            <span className={`${s.typeIcon} ${s[`tone_${type.tone}`]}`} aria-hidden>{type.icon}</span>
            <span className={s.whoText}>
              <span className={s.stepName} dir="auto">{run.label}</span>
              <span className={s.stepMeta}>
                <span className={s.typeText}>{type.label}</span>
                {run.status !== 'skipped' && run.durationMs != null && <span>⏱ {formatDuration(run.durationMs)}</span>}
                <span className={`${s.statusPill} ${status.cls}`}>{status.label}</span>
              </span>
            </span>
          </span>
          <span className={s.col}>
            <span className={s.colLabel}>Conclusion</span>
            <span className={`${s.colValue} ${bad ? s.badText : ''}`} dir="auto">{run.summary || '—'}</span>
          </span>
          <span className={s.col}>
            <span className={s.colLabel}>{thinking.length && !fields.length ? 'Saved to thinking' : 'Fields filled'}</span>
            <span className={s.chips}>
              {fields.slice(0, 4).map((w, i) => (
                <span key={i} className={s.fieldChip} dir="auto">{humanize(w.field)} = {clipText(short(w.value), 28)}</span>
              ))}
              {fields.length > 4 && <span className={s.moreChip}>+{fields.length - 4}</span>}
              {!fields.length && thinking.map(([dom, n]) => (
                <span key={dom} className={`${s.fieldChip} ${s.thinkChip}`}>{humanize(dom)} · {n}</span>
              ))}
              {!fields.length && !thinking.length && <span className={s.muted}>—</span>}
            </span>
          </span>
          <span className={s.caret} aria-hidden>{open ? '▴' : '▾'}</span>
        </button>
        {run.transitionTo && <div className={s.moveLine}>🔀 Moved the conversation to <b>{run.transitionTo}</b></div>}
        {open && <StepDetail agentSlug={agentSlug} run={run} />}
      </div>
    </div>
  );
}

/**
 * An opened add-on — designed with Leonardo (round 4, "expanded" X1 + X2):
 * the OUTPUT read as a judgement (facts, side-by-side picks, reasons as
 * paragraphs, lists), what it SAVED for later steps, and the input prompt
 * and raw model answer as quiet disclosures. Built from the output's own
 * shape, so it works for every add-on type.
 */
function StepDetail({ agentSlug, run }: { agentSlug: string; run: ConversationRunSummary }) {
  const [loaded, setLoaded] = useState<PersistedAddonRun | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getAddonRun({ agentSlug, runId: run.id }).then(r => { if (!cancelled) setLoaded(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [agentSlug, run.id]);
  const full = loaded?.id === run.id ? loaded : null;
  const d = full?.runData;
  const parsed = d?.parsedOutput;
  const rawJson = parsed !== undefined && parsed !== null ? JSON.stringify(parsed, null, 2) : (d?.rawOutput || '');
  const skipReason = run.status === 'skipped' ? run.summary : null;

  return (
    <div className={s.detail}>
      {run.modelLabel && <div className={s.detailModel}>✳ {run.modelLabel.providerName} · {run.modelLabel.modelName}</div>}
      {run.error?.message && <div className={s.runError} dir="auto">⚠ {run.error.message}</div>}
      {skipReason && <div className={s.skipNote} dir="auto">This step did not run — {skipReason}</div>}

      <Disclosure icon="⌨" title="Input" sub="the prompt this step received" open={showInput} onToggle={() => setShowInput(v => !v)} copy={d?.prompt || ''}>
        <pre className={s.inputBox} dir="auto">{d?.prompt || '(not recorded)'}</pre>
      </Disclosure>

      {!full ? <div className={s.muted}>Loading…</div> : !skipReason && (
        <section className={s.dSection}>
          <div className={s.dHead}>
            <span className={s.dTitle}>✦ Output</span><span className={s.dSub}>what the step concluded</span>
            <span className={s.spacer} /><CopyButton text={rawJson} />
          </div>
          {parsed !== undefined && parsed !== null
            ? <OutputView value={parsed} />
            : <div className={s.textBlock} dir="auto">{d?.rawOutput || <em className={s.muted}>(no output)</em>}</div>}
        </section>
      )}

      {run.writes.length > 0 && (
        <section className={s.dSection}>
          <div className={s.dHead}>
            <span className={s.dTitle}>🔖 Saved for later</span>
            <span className={s.dSub}>what the next steps can read</span>
          </div>
          <ol className={s.savedList}>
            {run.writes.map((w, i) => (
              <li key={i} className={s.savedItem}>
                <span className={s.savedNum}>{i + 1}</span>
                <span className={s.savedKey}>{humanize(w.field)}</span>
                <span className={s.savedVal} dir="auto">{clipText(short(w.value), 160)}</span>
                <span className={`${s.savedWhere} ${w.kind === 'thinking' ? s.thinkChip : ''}`}>
                  {w.kind === 'thinking' ? `Thinking · ${humanize(w.domain || 'thinking')}` : 'Profile field'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Disclosure icon="{ }" title="Raw model answer" sub="exactly what the model returned" open={showRaw} onToggle={() => setShowRaw(v => !v)} copy={d?.rawOutput || ''}>
        <pre className={s.rawBox} dir="auto">{d?.rawOutput || '(empty)'}</pre>
      </Disclosure>
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={s.copyBtn} disabled={!text}
      onClick={async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1400); } catch { /* refused */ } }}>
      {done ? '✓ Copied' : `⧉ ${label}`}
    </button>
  );
}

function Disclosure({ icon, title, sub, open, onToggle, copy, children }: {
  icon: string; title: string; sub: string; open: boolean; onToggle: () => void; copy: string; children: ReactNode;
}) {
  return (
    <section className={s.disclosure}>
      <button type="button" className={s.disclosureHead} onClick={onToggle} aria-expanded={open}>
        <span className={s.disclosureIcon} aria-hidden>{icon}</span>
        <span className={s.disclosureText}><span className={s.dTitle}>{title}</span><span className={s.dSub}>{sub}</span></span>
        <span className={s.spacer} />
        {open && <CopyButton text={copy} />}
        <span className={s.showBtn}>{open ? 'Hide' : 'Show'} {open ? '▴' : '▾'}</span>
      </button>
      {open && <div className={s.disclosureBody}>{children}</div>}
    </section>
  );
}

const LONG = 90;
const HEADLINE_KEYS = ['product_name', 'name', 'title', 'decision', 'recommendation', 'label', 'information'];
const isLongText = (v: unknown) => typeof v === 'string' && v.length > LONG;
const isWarnKey = (k: string) => /unverified|missing|open|pending|risk/i.test(k);

/** A judgement read as a document: facts first, then each judged object as its own card. */
function OutputView({ value }: { value: unknown }) {
  if (!isPlainObject(value)) {
    if (Array.isArray(value)) return <ListView items={value} />;
    return typeof value === 'string' ? <div className={s.textBlock} dir="auto"><LongText text={value} /></div> : <StructuredValue value={value} />;
  }
  const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return <div className={s.muted}>Found nothing new.</div>;
  const objects = entries.filter(([, v]) => isPlainObject(v));
  return (
    <div className={s.outStack}>
      <ObjectBody obj={Object.fromEntries(entries.filter(([, v]) => !isPlainObject(v)))} />
      {objects.map(([k, o], i) => (
        <PickCard key={k} title={humanize(k)} obj={o as Record<string, unknown>} primary={i === 0 && objects.length > 1} />
      ))}
    </div>
  );
}

/** The fields of one object: short values as a fact grid, long ones as labelled paragraphs, lists below. */
function ObjectBody({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const facts = entries.filter(([, v]) => typeof v !== 'object' && !isLongText(v));
  const texts = entries.filter(([, v]) => isLongText(v));
  const lists = entries.filter(([, v]) => Array.isArray(v));
  const nested = entries.filter(([, v]) => isPlainObject(v));
  if (entries.length === 0) return null;
  return (
    <>
      {facts.length > 0 && (
        <div className={s.factGrid}>
          {facts.map(([k, v]) => (
            <div key={k} className={s.fact}>
              <span className={s.factKey} dir="auto">{humanize(k)}</span>
              <span className={s.factVal} dir="auto">{short(v)}</span>
            </div>
          ))}
        </div>
      )}
      {texts.map(([k, v]) => (
        <div key={k} className={s.para}>
          <div className={s.paraKey} dir="auto">{humanize(k)}</div>
          <div className={s.textBlock} dir="auto"><LongText text={String(v)} /></div>
        </div>
      ))}
      {lists.map(([k, v]) => (
        <div key={k} className={`${s.para} ${isWarnKey(k) ? s.paraWarn : ''}`}>
          <div className={s.paraKey}>{isWarnKey(k) ? '⚠ ' : ''}{humanize(k)} <span className={s.countPill}>{(v as unknown[]).length}</span></div>
          <ListView items={v as unknown[]} />
        </div>
      ))}
      {nested.map(([k, v]) => <NestedDetails key={k} title={humanize(k)} obj={v as Record<string, unknown>} />)}
    </>
  );
}

function ListView({ items }: { items: unknown[] }) {
  const [all, setAll] = useState(false);
  if (items.length === 0) return <span className={s.muted}>none</span>;
  if (items.every(x => !x || typeof x !== 'object')) {
    return <ul className={s.bullets}>{items.map((x, i) => <li key={i} dir="auto">{short(x)}</li>)}</ul>;
  }
  const shown = all ? items : items.slice(0, 2);
  return (
    <ol className={s.itemList}>
      {shown.map((x, i) => (
        <li key={i} className={s.item}>
          <span className={s.itemNum}>{i + 1}</span>
          <div className={s.itemBody}>{isPlainObject(x) ? <ItemFields obj={x} /> : <span dir="auto">{short(x)}</span>}</div>
        </li>
      ))}
      {items.length > 2 && (
        <button type="button" className={s.moreBtn} onClick={() => setAll(v => !v)}>
          {all ? 'Show less ▴' : `Show ${items.length - 2} more ▾`}
        </button>
      )}
    </ol>
  );
}

/** One list item: short fields as tags on top, the rest as label → text rows. */
function ItemFields({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const tags = entries.filter(([, v]) => typeof v !== 'object' && String(v).length <= 32);
  const rows = entries.filter(([, v]) => !(typeof v !== 'object' && String(v).length <= 32));
  return (
    <>
      {tags.length > 0 && (
        <div className={s.tagRow}>
          {tags.map(([k, v]) => <span key={k} className={s.tag} dir="auto"><span className={s.tagKey}>{humanize(k)}</span> {short(v)}</span>)}
        </div>
      )}
      {rows.map(([k, v]) => (
        <div key={k} className={s.itemRow}>
          <span className={s.itemKey} dir="auto">{humanize(k)}</span>
          <span className={s.itemVal} dir="auto">{typeof v === 'string' ? <LongText text={v} /> : <StructuredValue value={v} />}</span>
        </div>
      ))}
    </>
  );
}

/** A big reference object (e.g. the product's full terms) — folded, opened on demand. */
function NestedDetails({ title, obj }: { title: string; obj: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const n = Object.keys(obj).length;
  return (
    <div className={s.nested}>
      <button type="button" className={s.nestedHead} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span>{open ? '▾' : '▸'}</span><span className={s.paraKey}>{title}</span><span className={s.countPill}>{n}</span>
      </button>
      {open && <div className={s.nestedBody}><ObjectBody obj={obj} /></div>}
    </div>
  );
}

/** One judged object (e.g. the main pick): its headline, then its fields. */
function PickCard({ title, obj, primary }: { title: string; obj: Record<string, unknown>; primary: boolean }) {
  const headKey = HEADLINE_KEYS.find(k => typeof obj[k] === 'string' && String(obj[k]).trim());
  const rest = Object.fromEntries(Object.entries(obj).filter(([k]) => k !== headKey));
  return (
    <div className={`${s.pick} ${primary ? s.pickPrimary : ''}`}>
      <div className={s.pickTop}>
        <span className={s.pickLabel}>{primary ? '★ ' : ''}{title}</span>
        {headKey && <span className={s.pickHead} dir="auto">{String(obj[headKey])}</span>}
      </div>
      <ObjectBody obj={rest} />
    </div>
  );
}

// ─── Agent's view after turn N ─────────────────────────────────────

/**
 * What the agent knew and thought after a turn — replayed from every
 * step's writes up to and including that turn. "New" = written in that turn.
 * Groups the agent knows nothing about yet fold away.
 */
function AgentView({ overview, turn }: { overview: ConversationOverview; turn: number }) {
  const { fields, panels } = overview.profile;
  const { known, newNow, thinking } = useMemo(() => {
    const known = new Map<string, unknown>();
    const newNow = new Set<string>();
    const thinking = new Map<string, Map<string, unknown>>();
    for (const r of overview.runs) {
      if ((r.turn ?? 0) > turn) continue;
      for (const w of r.writes) {
        if (w.kind === 'thinking') {
          const dom = w.domain || 'thinking';
          if (!thinking.has(dom)) thinking.set(dom, new Map());
          thinking.get(dom)!.set(w.field, w.value);
        } else if (w.value !== null && w.value !== undefined && w.value !== '') {
          known.set(w.field, w.value);
          if (r.turn === turn) newNow.add(w.field);
        }
      }
    }
    return { known, newNow, thinking };
  }, [overview.runs, turn]);

  const groups = useMemo(() => {
    const m = new Map<string, typeof fields>();
    for (const f of fields) {
      const k = f.domain || 'General';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    const knownIn = (list: typeof fields) => list.filter(f => known.has(f.name)).length;
    return [...m.entries()]
      .map(([k, list]) => ({ key: k, list: [...list].sort((a, b) => Number(known.has(b.name)) - Number(known.has(a.name))), knownCount: knownIn(list) }))
      .sort((a, b) => b.knownCount - a.knownCount);
  }, [fields, known]);
  const filled = fields.filter(f => known.has(f.name)).length;
  const isLast = turn >= overview.runs.reduce((mx, r) => Math.max(mx, r.turn ?? 0), 0);

  return (
    <div className={s.view}>
      <div className={s.viewTitle}>Agent's view after {turn === 0 ? 'the opening' : `turn ${turn}`}</div>
      <div className={s.viewSummary}>
        <span><b>{filled}</b> of {fields.length} fields known</span>
        {newNow.size > 0 && <span className={s.newPill}>{newNow.size} new this turn</span>}
      </div>
      <div className={s.progress}><div className={s.progressFill} style={{ width: `${fields.length ? (filled / fields.length) * 100 : 0}%` }} /></div>

      {groups.map(g => (
        <ViewGroup key={g.key} title={humanize(g.key)} icon="👤" count={`${g.knownCount}/${g.list.length}`} startOpen={g.knownCount > 0}>
          {g.list.map(f => {
            const has = known.has(f.name);
            return (
              <div key={f.name} className={`${s.vRow} ${has ? '' : s.vRowEmpty}`}>
                <span className={s.vKey} title={f.name}>{humanize(f.name)}</span>
                <span className={s.vVal} dir="auto">{has ? <ViewValue value={known.get(f.name)} /> : 'not yet'}</span>
                <span className={s.vMark}>{newNow.has(f.name) ? <span className={s.newPill}>New</span> : <span className={has ? s.dotKnown : s.dotEmpty} />}</span>
              </div>
            );
          })}
        </ViewGroup>
      ))}

      {thinking.size > 0 && (
        <ViewGroup title="Thinking" icon="💭" count={`${thinking.size} area${thinking.size === 1 ? '' : 's'}`} startOpen tone="amber">
          {[...thinking.entries()].map(([dom, m]) => (
            <div key={dom} className={s.thinkArea}>
              <div className={s.thinkAreaTitle}>{humanize(dom)}</div>
              {[...m.entries()].map(([k, v]) => (
                <div key={k} className={s.vRow}>
                  <span className={s.vKey} dir="auto">{humanize(k)}</span>
                  <span className={s.vVal}><LongText text={short(v)} /></span>
                  <span className={s.vMark} />
                </div>
              ))}
            </div>
          ))}
        </ViewGroup>
      )}

      {isLast && panels.length > 0 && panels.map((p, i) => (
        <ViewGroup key={p.id || i} title={p.title} icon="🪪" count="Profiler" startOpen>
          {p.text !== undefined ? <div className={s.cardText} dir="auto">{String(p.text)}</div>
            : isPlainObject(p.values) ? <div className={s.panelBody}><ObjectBody obj={p.values} /></div> : <StructuredValue value={p.values} />}
        </ViewGroup>
      ))}
    </div>
  );
}

/** A known value as a person would say it: Yes/No, words instead of snake_case. */
function ViewValue({ value }: { value: unknown }) {
  if (value === true || value === 'true') return <span className={s.yes}>✓ Yes</span>;
  if (value === false || value === 'false') return <span className={s.no}>✗ No</span>;
  const text = short(value);
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(text)) return <>{humanize(text)}</>;
  return <>{clipText(text, 120)}</>;
}

function ViewGroup({ title, icon, count, startOpen, tone, children }: {
  title: string;
  icon: string;
  count: string;
  startOpen: boolean;
  tone?: 'amber';
  children: ReactNode;
}) {
  const [open, setOpen] = useState(startOpen);
  return (
    <div className={`${s.vCard} ${tone === 'amber' ? s.vCardAmber : ''}`}>
      <button type="button" className={s.vCardHead} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span aria-hidden>{icon}</span>
        <span className={s.vCardTitle} dir="auto">{title}</span>
        <span className={s.muted}>{count}</span>
        <span className={s.spacer} />
        <span className={s.caret} aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className={s.vCardBody}>{children}</div>}
    </div>
  );
}

// ─── Shared: one conversation as bubbles (also Admin → Simulations) ─

/**
 * One conversation as a chat thread. Each message takes its direction from
 * its own text (#917). `refreshKey` re-reads the same conversation in place.
 */
export function ConversationDetail({ agentSlug, conversationId, refreshKey = 0, emptyText }: {
  agentSlug: string;
  conversationId: number;
  refreshKey?: number | string;
  emptyText?: string;
}) {
  const [loaded, setLoaded] = useState<{ id: number; messages: ConversationMessage[] } | null>(null);
  const [failed, setFailed] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchConversationMessages({ agentSlug, conversationId })
      .then(msgs => { if (!cancelled) { setLoaded({ id: conversationId, messages: msgs }); setFailed(null); } })
      .catch(e => { if (!cancelled) setFailed({ id: conversationId, message: e instanceof Error ? e.message : String(e) }); });
    return () => { cancelled = true; };
  }, [agentSlug, conversationId, refreshKey]);

  const error = failed?.id === conversationId ? failed.message : null;
  const messages = loaded?.id === conversationId ? loaded.messages : null;
  if (error && !messages) return <div className={styles.error}>{error}</div>;
  if (!messages) return <div className={styles.detailEmpty}>Loading messages…</div>;
  if (messages.length === 0) return <div className={styles.detailEmpty}>{emptyText ?? 'No messages in this conversation.'}</div>;

  return (
    <div className={s.thread}>
      {messages.map(m => <MessageBubble key={m.id} agentSlug={agentSlug} message={m} />)}
    </div>
  );
}

function MessageBubble({ agentSlug, message }: { agentSlug: string; message: ConversationMessage }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<PersistedAddonRun[] | null>(null);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && runs == null) {
      try { setRuns(await fetchRunsForMessage({ agentSlug, messageId: message.id })); } catch { setRuns([]); }
    }
  };
  return (
    <div className={`${s.msg} ${isUser ? s.msgUser : s.msgBot}`}>
      <div className={s.speaker}>{isUser ? 'User' : isAssistant ? 'Lybi' : message.role}</div>
      <div className={`${s.bubble} ${isUser ? s.bubbleUser : s.bubbleBot}`} dir="auto">
        {isAssistant ? <MarkdownBody text={message.content || ''} /> : (message.content || <em className={s.muted}>(empty)</em>)}
      </div>
      <div className={s.msgMeta}>
        <span>{fmtTime(message.createdAt)}</span>
        {isAssistant && <button type="button" className={s.trailLink} onClick={toggle}>add-on trail {open ? '▾' : '▸'}</button>}
      </div>
      {isAssistant && open && (
        <div className={styles.runs}>
          {runs == null && <div className={styles.muted}>Loading add-on trail…</div>}
          {runs && runs.length === 0 && <div className={styles.muted}>No add-on runs recorded for this message.</div>}
          {runs && runs.map(r => (
            <div key={r.id} className={styles.run}>
              <div className={styles.runHead}>
                <span className={`${styles.runStatus} ${styles[`status_${r.status}`] || ''}`}>{r.status}</span>
                <span className={styles.runPlugin}>{r.pluginId}</span>
                {r.runData?.label && <span className={styles.runLabel}>{r.runData.label}</span>}
                {r.durationMs != null && <span className={styles.runDur}>{formatDuration(r.durationMs)}</span>}
              </div>
              {r.runData?.rawOutput && <pre className={styles.runRaw} dir="auto">{r.runData.rawOutput}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Structured JSON: headings, key–value cards, tables ────────────

function humanize(key: string): string {
  const t = String(key).replace(/^_+/, '').replace(/[_-]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : key;
}

function short(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function LongText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= 280) return <span dir="auto">{text}</span>;
  return (
    <span dir="auto">
      {open ? text : `${text.slice(0, 280)}…`}{' '}
      <button type="button" className={s.trailLink} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>{open ? 'less' : 'more'}</button>
    </span>
  );
}

function StructuredValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === '') return <span className={s.muted}>—</span>;
  if (typeof value === 'string') return <LongText text={value} />;
  if (typeof value !== 'object') return <span>{String(value)}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className={s.muted}>none</span>;
    if (value.every(v => !v || typeof v !== 'object')) {
      return <ul className={s.list}>{value.map((v, i) => <li key={i} dir="auto">{short(v)}</li>)}</ul>;
    }
    const objects = value.filter(isPlainObject);
    const cols = [...new Set(objects.flatMap(o => Object.keys(o)))];
    const flat = objects.length === value.length && objects.every(o => Object.values(o).every(v => !v || typeof v !== 'object'));
    if (flat && cols.length <= 6) {
      return (
        <table className={s.dataTable}>
          <thead><tr>{cols.map(c => <th key={c}>{humanize(c)}</th>)}</tr></thead>
          <tbody>{objects.map((o, i) => <tr key={i}>{cols.map(c => <td key={c} dir="auto">{short(o[c])}</td>)}</tr>)}</tbody>
        </table>
      );
    }
    return <div className={s.stack}>{value.map((v, i) => <div key={i} className={s.card}><StructuredValue value={v} depth={depth + 1} /></div>)}</div>;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const nested = entries.filter(([, v]) => v && typeof v === 'object');
  const flatEntries = entries.filter(([, v]) => !v || typeof v !== 'object');
  return (
    <div className={s.stack}>
      {flatEntries.length > 0 && (
        <div className={depth === 0 ? s.card : undefined}>
          {flatEntries.map(([k, v]) => (
            <div key={k} className={s.kv}>
              <span className={s.kvKey} dir="auto">{humanize(k)}</span>
              <span className={s.kvVal}><StructuredValue value={v} depth={depth + 1} /></span>
            </div>
          ))}
        </div>
      )}
      {nested.map(([k, v]) => (
        <div key={k} className={s.card}>
          <div className={s.cardTitle} dir="auto">{humanize(k)}</div>
          <StructuredValue value={v} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}
