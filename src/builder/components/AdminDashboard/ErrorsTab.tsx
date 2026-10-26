/**
 * ErrorsTab — Admin → Errors (task #903, the error center).
 *
 * Every error that happened while this agent handled a conversation,
 * grouped so the same problem is one line and not a thousand. Laid out for
 * the questions people come with, in that order (design study:
 * verification/error-center/design/):
 *
 *   strip  how bad is it right now — groups per status as one-click filters,
 *          customer conversations hit in the last 24 h, errors per day
 *   left   the problems, most urgent first: a short title, WHERE (area +
 *          the add-on / model / trigger) and WHO it hit, ×count, when. A red
 *          edge = it hit customers and nobody has handled it. One search box
 *          and one Filters window instead of a wall of dropdowns
 *   right  the opened problem: status as one-click buttons (always in the
 *          same place) + a Note window; "What happened" in one sentence;
 *          its errors per day; every occurrence with "Open conversation";
 *          the picked occurrence's conversation; technical details folded
 *          away at the very bottom
 *
 * Nothing resizes or jumps on click: the strip, the status control and the
 * occurrence table keep their size; the newest occurrence is open from the
 * start; the only fold is the last block on the page.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ERRORS_CHANGED_EVENT,
  getErrorSummary,
  listErrorGroups,
  listErrorOccurrences,
  setErrorNote,
  setErrorStatus,
  type ErrorArea,
  type ErrorDay,
  type ErrorGroup,
  type ErrorKind,
  type ErrorOccurrence,
  type ErrorSource,
  type ErrorStatus,
  type ErrorSummary,
} from '../../state/builderApi';
import { Modal } from '../Modal/Modal';
import { ConversationDetail } from './ConversationsTab';
import convStyles from './ConversationsTab.module.css';
import simStyles from './SimulationsTab.module.css';
import styles from './ErrorsTab.module.css';

const POLL_MS = 30_000;
const BY_KEY = 'builder:simulationBy';

const AREA_LABEL: Record<ErrorArea, string> = {
  turn: 'Whole turn',
  addon: 'Add-on',
  model: 'Model call',
  offline: 'Offline add-on',
  trigger: 'Trigger',
  profiler: 'Profiler',
  'live-brain': 'Live Brain',
  simulation: 'Simulation',
  server: 'Server',
};
/** The subject of the "What happened" sentence. */
const AREA_PHRASE: Record<ErrorArea, string> = {
  turn: 'A whole turn',
  addon: 'An add-on',
  model: 'A model call',
  offline: 'An offline add-on',
  trigger: 'A trigger',
  profiler: 'A Profiler panel',
  'live-brain': 'A Live Brain panel',
  simulation: 'A simulation',
  server: 'The server',
};

const KIND_LABEL: Record<ErrorKind, string> = {
  model_rate_limit: 'Rate limit',
  model_timeout: 'Timeout',
  model_refusal: 'Refusal',
  model_bad_answer: 'Bad answer',
  model_other: 'Model error',
  database: 'Database',
  external: 'External service',
  server_unavailable: 'Server unavailable',
  user_input: 'User input',
  code: 'Our code',
};
const KIND_TITLE: Record<ErrorKind, string> = {
  model_rate_limit: 'The model provider said "too many requests" — retried automatically',
  model_timeout: 'A call took too long and was cut off',
  model_refusal: 'The model refused to answer',
  model_bad_answer: 'The model answered in a shape we could not use',
  model_other: 'Any other error from the model provider',
  database: 'Reading or writing the database failed',
  external: 'Another service could not be reached',
  server_unavailable: 'Our server could not take the request — busy or down',
  user_input: 'Something in what the user sent',
  code: 'A bug or a broken setup on our side',
};

const SOURCE_LABEL: Record<ErrorSource, string> = { customer: 'Customer', builder: 'Builder', simulation: 'Simulation' };
const SOURCE_ORDER: ErrorSource[] = ['customer', 'builder', 'simulation'];

const STATUS_LABEL: Record<ErrorStatus, string> = { new: 'New', looking: 'Looking at it', handled: 'Handled', ignored: 'Ignored' };
const STATUS_TITLE: Record<ErrorStatus, string> = {
  new: 'Nobody has looked at it yet',
  looking: 'Someone is on it',
  handled: 'Fixed or dealt with — it comes back by itself if it happens again',
  ignored: 'Known and harmless — stays quiet even if it happens again',
};
const STATUSES: ErrorStatus[] = ['new', 'looking', 'handled', 'ignored'];

/** The strip's filters. "attention" = new, including handled ones that came back. */
type StatusFilter = '' | 'attention' | 'looking' | 'handled' | 'ignored';
const URGENCY: Record<string, number> = { back: 0, new: 0, looking: 1, handled: 2, ignored: 3 };

interface Filters { source: ErrorSource | ''; area: ErrorArea | ''; kind: ErrorKind | ''; sort: 'recent' | 'frequent' }
const NO_FILTERS: Filters = { source: '', area: '', kind: '', sort: 'recent' };

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}
function fmtDay(iso: string): string {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return iso; }
}
/** "3 min ago" — the exact time is in the tooltip. */
function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const effective = (g: ErrorGroup) => (g.reopened ? 'back' : g.status);
/** Hit customers and nobody has dealt with it — the red edge. */
const hurtsCustomers = (g: ErrorGroup) => g.sources.customer > 0 && (g.status === 'new' || g.status === 'looking' || g.reopened);

function myName(): string {
  try { return localStorage.getItem(BY_KEY) || ''; } catch { return ''; }
}

export function ErrorsTab({ agentSlug }: { agentSlug: string }) {
  const [summary, setSummary] = useState<ErrorSummary | null>(null);
  const [groups, setGroups] = useState<ErrorGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [noteFor, setNoteFor] = useState<ErrorGroup | null>(null);
  const [selectedFp, setSelectedFp] = useState<string | null>(null);
  // Bumping `tick` re-reads everything (refresh, a status change, the poll).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getErrorSummary({ agentSlug }).then(s => { if (!cancelled) setSummary(s); }).catch(() => { /* the list still shows */ });
    return () => { cancelled = true; };
  }, [agentSlug, tick]);

  useEffect(() => {
    let cancelled = false;
    const status = statusFilter === 'attention' ? 'new' : statusFilter;
    listErrorGroups({ agentSlug, status, source: filters.source, area: filters.area, kind: filters.kind, sort: filters.sort })
      .then(list => { if (!cancelled) { setGroups(list); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [agentSlug, statusFilter, filters, tick]);

  // Search narrows what is loaded; "Most urgent" puts what needs attention first.
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (groups ?? []).filter(g => !q
      || g.message.toLowerCase().includes(q)
      || (g.where ?? '').toLowerCase().includes(q)
      || (g.code ?? '').toLowerCase().includes(q));
    if (filters.sort === 'recent') {
      list.sort((a, b) => (URGENCY[effective(a)] - URGENCY[effective(b)]) || (new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()));
    }
    return list;
  }, [groups, search, filters.sort]);

  const selected = groups?.find(g => g.fingerprint === selectedFp) ?? null;
  const activeFilters = [filters.source, filters.area, filters.kind].filter(Boolean).length + (filters.sort === 'frequent' ? 1 : 0);
  const changed = () => {
    setTick(n => n + 1);
    window.dispatchEvent(new Event(ERRORS_CHANGED_EVENT));
  };

  const setStatus = async (g: ErrorGroup, status: ErrorStatus) => {
    // Shown at once; the server confirms on the re-read.
    setGroups(prev => prev?.map(x => (x.fingerprint === g.fingerprint ? { ...x, status, reopened: false, statusBy: myName() || x.statusBy, statusAt: new Date().toISOString() } : x)) ?? null);
    try {
      await setErrorStatus({ agentSlug, fingerprint: g.fingerprint, status, note: g.note, by: myName() });
    } finally {
      changed();
    }
  };

  const b = summary?.byStatus;
  const pills: { key: StatusFilter; label: string; n: number | null; title: string; cls: string }[] = [
    { key: 'attention', label: 'Needs attention', n: b ? b.new + b.back : null, title: 'New, and handled ones that came back', cls: styles.pillAttention },
    { key: 'looking', label: 'Looking at it', n: b ? b.looking : null, title: STATUS_TITLE.looking, cls: styles.pillLooking },
    { key: 'handled', label: 'Handled', n: b ? b.handled : null, title: STATUS_TITLE.handled, cls: styles.pillHandled },
    { key: 'ignored', label: 'Ignored', n: b ? b.ignored : null, title: STATUS_TITLE.ignored, cls: styles.pillIgnored },
  ];

  return (
    <div className={styles.page}>
      {/* ── How bad is it right now ── */}
      <div className={styles.strip}>
        <div className={styles.pills} role="tablist" aria-label="Show errors by status">
          {pills.map(p => (
            <button key={p.key} type="button" role="tab" aria-selected={statusFilter === p.key}
              className={`${styles.pill} ${p.cls} ${statusFilter === p.key ? styles.pillOn : ''}`}
              title={`${p.title} — click to show only these, again to show all`}
              onClick={() => setStatusFilter(statusFilter === p.key ? '' : p.key)}>
              {p.label}
              <span className={styles.pillCount}>{p.n ?? '–'}</span>
            </button>
          ))}
        </div>
        <span className={styles.stripDivider} />
        <span className={styles.stripStat} title="Customer conversations in which an error happened, in the last 24 hours">
          Customer conversations hit <b className={summary && summary.customerConversations24h > 0 ? styles.stripBad : ''}>{summary ? summary.customerConversations24h : '–'}</b> <span className={styles.stripMuted}>24 h</span>
        </span>
        <span className={styles.stripDivider} />
        <span className={styles.stripStat}>Errors per day <span className={styles.stripMuted}>14 d</span></span>
        <DayBars days={summary?.perDay ?? []} width={170} height={28} compact />
        <span className={convStyles.detailSpacer} />
        <button type="button" className={convStyles.refresh} onClick={() => setTick(n => n + 1)} title="Refresh">↻</button>
      </div>

      <div className={styles.panes}>
        {/* ── The problems ── */}
        <aside className={styles.list}>
          <div className={styles.listTools}>
            <input className={styles.search} type="search" placeholder="Search errors…" value={search} onChange={e => setSearch(e.target.value)} />
            <button type="button" className={`${styles.filtersBtn} ${activeFilters ? styles.filtersOn : ''}`} onClick={() => setFiltersOpen(true)}
              title="Who it hit, where, what kind, and the order">
              Filters{activeFilters ? ` · ${activeFilters}` : ''}
            </button>
          </div>
          {error && <div className={convStyles.error}>{error}</div>}
          {groups !== null && shown.length === 0 && !error && (
            <div className={simStyles.emptyList}>
              <b>{statusFilter === 'attention' && !search && !activeFilters ? 'Nothing needs attention.' : statusFilter || search || activeFilters ? 'No errors match.' : 'No errors in the last month.'}</b>
              {(statusFilter || search || activeFilters) ? (
                <button type="button" className={styles.linkBtn} onClick={() => { setStatusFilter(''); setSearch(''); setFilters(NO_FILTERS); }}>Show all errors</button>
              ) : <span>When a conversation with this agent fails, it shows here.</span>}
            </div>
          )}
          <div className={styles.cards}>
            {shown.map(g => {
              const st = effective(g);
              return (
                <button key={g.fingerprint} type="button"
                  className={`${styles.card} ${hurtsCustomers(g) ? styles.cardHurts : ''} ${g.fingerprint === selectedFp ? styles.cardOn : ''} ${st === 'handled' || st === 'ignored' ? styles.cardQuiet : ''}`}
                  onClick={() => setSelectedFp(g.fingerprint)}>
                  <span className={styles.cardMain}>
                    <span className={styles.cardTitle} dir="auto">{g.message}</span>
                    <span className={styles.cardChips}>
                      <WhereChip g={g} />
                      <WhoChips g={g} />
                    </span>
                  </span>
                  <span className={styles.cardSide}>
                    <span className={styles.count} title={`${plural(g.count, 'time')} in ${plural(g.conversations, 'conversation')}`}>×{g.count}</span>
                    <span className={styles.when} title={fmtDate(g.lastSeen)}>{ago(g.lastSeen)}</span>
                    {st !== 'new' && <StatusChip g={g} />}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── The opened problem ── */}
        <section className={styles.detail}>
          {!selected ? (
            <div className={convStyles.detailEmpty}>
              {shown.length > 0 ? 'Pick an error to see what happened and every time it did.' : 'Errors appear here grouped — one line per problem.'}
            </div>
          ) : (
            <GroupDetail key={selected.fingerprint} agentSlug={agentSlug} group={selected} refreshKey={tick}
              onStatus={st => setStatus(selected, st)} onNote={() => setNoteFor(selected)} />
          )}
        </section>
      </div>

      {filtersOpen && (
        <FiltersModal value={filters} onClose={() => setFiltersOpen(false)} onApply={f => { setFilters(f); setFiltersOpen(false); }} />
      )}
      {noteFor && (
        <NoteModal agentSlug={agentSlug} group={noteFor} onClose={() => setNoteFor(null)} onSaved={() => { setNoteFor(null); changed(); }} />
      )}
    </div>
  );
}

function WhereChip({ g }: { g: ErrorGroup }) {
  return (
    <span className={styles.where} title={`${AREA_LABEL[g.area] ?? g.area}${g.code ? ` · ${g.code}` : ''}`}>
      {AREA_LABEL[g.area] ?? g.area}{g.where ? ` · ${g.where}` : ''}
    </span>
  );
}

/** In a card: who it hit most importantly (customers first) and "+n" for the rest — one line always. */
function WhoChips({ g }: { g: ErrorGroup }) {
  const hit = SOURCE_ORDER.filter(s => g.sources[s] > 0);
  if (hit.length === 0) return null;
  const all = hit.map(s => `${SOURCE_LABEL[s]} ${g.sources[s]}`).join(' · ');
  return (
    <>
      <span className={`${styles.who} ${styles[`who_${hit[0]}`]}`} title={all}>{SOURCE_LABEL[hit[0]]}</span>
      {hit.length > 1 && <span className={`${styles.who} ${styles.whoMore}`} title={all}>+{hit.length - 1}</span>}
    </>
  );
}

function StatusChip({ g }: { g: ErrorGroup }) {
  const st = effective(g);
  return (
    <span className={`${styles.statusChip} ${styles[`st_${st}`]}`}
      title={st === 'back' ? 'Marked handled, and it happened again' : STATUS_TITLE[g.status]}>
      {st === 'back' ? 'Back' : STATUS_LABEL[g.status]}
    </span>
  );
}

function GroupDetail({ agentSlug, group, refreshKey, onStatus, onNote }: {
  agentSlug: string; group: ErrorGroup; refreshKey: number;
  onStatus: (s: ErrorStatus) => void; onNote: () => void;
}) {
  const [data, setData] = useState<{ occurrences: ErrorOccurrence[]; perDay: ErrorDay[] } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [techOpen, setTechOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listErrorOccurrences({ agentSlug, fingerprint: group.fingerprint })
      .then(d => { if (!cancelled) { setData(d); setFailed(null); } })
      .catch(e => { if (!cancelled) setFailed(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [agentSlug, group.fingerprint, refreshKey]);

  const occurrences = data?.occurrences ?? null;
  // The newest occurrence is open from the start — nothing appears on click.
  const picked = occurrences?.find(o => o.id === pickedId) ?? occurrences?.[0] ?? null;
  const st = effective(group);
  const who = SOURCE_ORDER.filter(s => group.sources[s] > 0).map(s => plural(group.sources[s], s)).join(', ');
  const sentence = `${AREA_PHRASE[group.area] ?? 'Something'}${group.where ? ` (${group.where})` : ''} failed ${plural(group.count, 'time')}`
    + `${group.conversations ? ` in ${plural(group.conversations, 'conversation')}` : ''}${who ? ` (${who})` : ''}`
    + ` since ${fmtDay(group.firstSeen)}. Last time ${ago(group.lastSeen)}.`;
  const stack = picked && typeof picked.detail.stack === 'string' ? picked.detail.stack : '';
  const techFacts = picked
    ? Object.entries(picked.detail).filter(([k]) => k !== 'stack').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    : [];
  const adminBase = `/${agentSlug}/builder/admin`;

  return (
    <>
      <div className={styles.head}>
        <div className={styles.headText}>
          <div className={styles.headTitle} dir="auto" title={group.message}>{group.message}</div>
          <div className={styles.chips}>
            <WhereChip g={group} />
            {SOURCE_ORDER.filter(s => group.sources[s] > 0).map(s => (
              <span key={s} className={`${styles.who} ${styles[`who_${s}`]}`}>{SOURCE_LABEL[s]} {group.sources[s]}</span>
            ))}
            {st === 'back' && <StatusChip g={group} />}
          </div>
        </div>
        <div className={styles.statusSeg} role="radiogroup" aria-label="Status">
          {STATUSES.map(s => {
            const on = (group.status === s && !group.reopened) || (s === 'new' && group.reopened);
            return (
              <button key={s} type="button" role="radio" aria-checked={on}
                className={`${styles.segBtn} ${on ? styles[`segOn_${s}`] : ''}`}
                title={STATUS_TITLE[s]} onClick={() => onStatus(s)}>
                {STATUS_LABEL[s]}
              </button>
            );
          })}
        </div>
        {/* Same label and width with or without a note, so the status control never shifts. */}
        <button type="button" className={`${convStyles.exportBtn} ${styles.noteBtn}`} onClick={onNote}
          title={group.note ? 'Edit the note on what was done' : 'Write what was done about it'}>
          Note{group.note && <span className={styles.noteDot} aria-label="has a note" />}
        </button>
      </div>

      <div className={styles.facts}>
        <div className={`${styles.factCard} ${styles.factWhat}`}>
          <span className={styles.label}>What happened</span>
          <span className={styles.sentence}>{sentence}</span>
          <span className={styles.message} dir="auto">{group.message}</span>
          {group.note && (
            <span className={styles.note} dir="auto" title={group.statusAt ? fmtDate(group.statusAt) : undefined}>
              <b>Note{group.statusBy ? ` · ${group.statusBy}` : ''}:</b> {group.note}
            </span>
          )}
        </div>
        <div className={styles.factCard} title={KIND_TITLE[group.kind]}>
          <span className={styles.label}>Kind</span>
          <span className={styles.factValue}>{KIND_LABEL[group.kind] ?? group.kind}</span>
          <span className={styles.factSub}>{KIND_TITLE[group.kind]}</span>
        </div>
        <div className={styles.factCard}>
          <span className={styles.label}>First seen</span>
          <span className={styles.factValue}>{fmtDay(group.firstSeen)}</span>
          <span className={styles.factSub}>{new Date(group.firstSeen).toLocaleTimeString()}</span>
        </div>
        <div className={styles.factCard}>
          <span className={styles.label}>Last seen</span>
          <span className={styles.factValue}>{ago(group.lastSeen)}</span>
          <span className={styles.factSub}>{fmtDate(group.lastSeen)}</span>
        </div>
      </div>

      <div className={styles.block}>
        <div className={styles.blockHead}><span className={styles.label}>Over the last 14 days</span></div>
        <DayBars days={data?.perDay ?? []} width={900} height={110} />
      </div>

      <div className={styles.block}>
        <div className={styles.blockHead}><span className={styles.label}>Occurrences{occurrences ? ` (${occurrences.length})` : ''}</span></div>
        <div className={`${styles.occRow} ${styles.occHeadRow}`}>
          <span>Time</span><span>Who</span><span>Conversation</span><span />
        </div>
        <div className={styles.occScroll}>
          {failed && <div className={convStyles.error}>{failed}</div>}
          {!occurrences && !failed && <div className={styles.occEmpty}>Loading…</div>}
          {(occurrences ?? []).map(o => (
            <div key={o.id} role="button" tabIndex={0}
              className={`${styles.occRow} ${picked?.id === o.id ? styles.occRowOn : ''}`}
              onClick={() => setPickedId(o.id)}
              onKeyDown={e => { if (e.key === 'Enter') setPickedId(o.id); }}>
              <span className={styles.occTime}>{fmtDate(o.createdAt)}</span>
              <span>{o.source ? <span className={`${styles.who} ${styles[`who_${o.source}`]}`}>{SOURCE_LABEL[o.source]}</span> : <span className={styles.muted}>—</span>}</span>
              <span>{o.conversationId != null ? `#${o.conversationId}` : <span className={styles.muted}>none</span>}</span>
              <span className={styles.occAction}>
                {o.conversationId != null && (
                  <Link to={`${adminBase}/conversations?c=${o.conversationId}`} onClick={e => e.stopPropagation()} className={styles.openLink}>
                    Open conversation →
                  </Link>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {picked?.conversationId != null && (
        <div className={styles.block}>
          <div className={styles.blockHead}><span className={styles.label}>Conversation #{picked.conversationId} · {fmtDate(picked.createdAt)}</span></div>
          <ConversationDetail agentSlug={agentSlug} conversationId={picked.conversationId} />
        </div>
      )}

      {/* The one fold on the page — last, so opening it moves nothing above. */}
      <div className={styles.block}>
        <button type="button" className={styles.techToggle} onClick={() => setTechOpen(o => !o)} aria-expanded={techOpen}>
          <span className={styles.chev} aria-hidden>{techOpen ? '▾' : '▸'}</span>
          Technical details
          <span className={styles.muted}>error code, add-on, stack — of the picked occurrence</span>
        </button>
        {techOpen && (
          <pre className={styles.tech}>{picked ? [...techFacts, stack].filter(Boolean).join('\n') || 'No technical details.' : ''}</pre>
        )}
      </div>
    </>
  );
}

/**
 * Errors per day: one bar per day, oldest left, hover for the day. Single
 * series in the app's accent — no legend; the label above names it.
 */
function DayBars({ days, width, height, compact }: { days: ErrorDay[]; width: number; height: number; compact?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length || 14;
  const axis = compact ? 0 : 16;
  const max = Math.max(1, ...days.map(d => d.count));
  const slot = width / n;
  const bw = Math.max(2, Math.min(compact ? 8 : 28, slot - (compact ? 3 : 8)));
  const plotH = height - axis;
  const h = hover != null ? days[hover] : undefined;
  return (
    <div className={compact ? styles.barsCompact : styles.bars} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} width={compact ? width : '100%'} height={height} preserveAspectRatio="none" role="img"
        aria-label={`Errors per day: ${days.map(d => `${d.day} ${d.count}`).join(', ')}`}>
        {!compact && <line x1={0} x2={width} y1={plotH + 0.5} y2={plotH + 0.5} className={styles.barAxis} />}
        {days.map((d, i) => {
          const bh = d.count ? Math.max(3, (d.count / max) * (plotH - 4)) : 1.5;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={i * slot} y={0} width={slot} height={height} fill="transparent" />
              <rect x={i * slot + (slot - bw) / 2} y={plotH - bh} width={bw} height={bh} rx={2}
                className={d.count ? (hover === i ? styles.barOn : styles.bar) : styles.barZero} />
              {!compact && (i % 2 === (n - 1) % 2) && (
                <text x={i * slot + slot / 2} y={height - 3} textAnchor="middle" className={styles.barTick}>{fmtDay(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover != null && (
        <span className={styles.barTip} style={{ left: `${((hover + 0.5) / n) * 100}%` }}>
          {fmtDay(h.day)} · {plural(h.count, 'error')}
        </span>
      )}
    </div>
  );
}

/** Who / where / kind / order — one window instead of a wall of dropdowns. */
function FiltersModal({ value, onClose, onApply }: { value: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const [f, setF] = useState<Filters>(value);
  return (
    <Modal open onClose={onClose} title="Filters" width={480}
      footer={
        <>
          <button type="button" className={styles.linkBtn} onClick={() => setF(NO_FILTERS)}>Clear all</button>
          <span className={convStyles.detailSpacer} />
          <button type="button" className={simStyles.formBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={`${simStyles.formBtn} ${simStyles.formBtnPrimary}`} onClick={() => onApply(f)}>Show</button>
        </>
      }>
      <div className={simStyles.form}>
        <div className={simStyles.formField}>
          <span className={simStyles.formLabel}>Who it hit</span>
          <div className={simStyles.seg}>
            {(['', 'customer', 'builder', 'simulation'] as const).map(s => (
              <button key={s || 'all'} type="button" className={`${simStyles.segBtn} ${f.source === s ? simStyles.segOn : ''}`} onClick={() => setF({ ...f, source: s })}>
                {s ? SOURCE_LABEL[s] : 'Anyone'}
              </button>
            ))}
          </div>
        </div>
        <label className={simStyles.formField}>
          <span className={simStyles.formLabel}>Where</span>
          <select className={simStyles.formInput} value={f.area} onChange={e => setF({ ...f, area: e.target.value as ErrorArea | '' })}>
            <option value="">Anywhere</option>
            {(Object.keys(AREA_LABEL) as ErrorArea[]).map(a => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
          </select>
        </label>
        <label className={simStyles.formField}>
          <span className={simStyles.formLabel}>Kind</span>
          <select className={simStyles.formInput} value={f.kind} onChange={e => setF({ ...f, kind: e.target.value as ErrorKind | '' })}>
            <option value="">Any kind</option>
            {(Object.keys(KIND_LABEL) as ErrorKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <div className={simStyles.formField}>
          <span className={simStyles.formLabel}>Order</span>
          <div className={simStyles.seg}>
            <button type="button" className={`${simStyles.segBtn} ${f.sort === 'recent' ? simStyles.segOn : ''}`} onClick={() => setF({ ...f, sort: 'recent' })}
              title="What needs attention first, then the newest">Most urgent</button>
            <button type="button" className={`${simStyles.segBtn} ${f.sort === 'frequent' ? simStyles.segOn : ''}`} onClick={() => setF({ ...f, sort: 'frequent' })}>Most often</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** What was done about it — a short note, kept with the status. */
function NoteModal({ agentSlug, group, onClose, onSaved }: {
  agentSlug: string; group: ErrorGroup; onClose: () => void; onSaved: () => void;
}) {
  const [note, setNote] = useState(group.note);
  const [by, setBy] = useState(myName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      try { if (by.trim()) localStorage.setItem(BY_KEY, by.trim()); } catch { /* private mode */ }
      // Only the note — a group that came back stays "back".
      await setErrorNote({ agentSlug, fingerprint: group.fingerprint, note: note.trim(), by: by.trim() });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title="Note" width={520}
      footer={
        <>
          <span className={simStyles.formError}>{error}</span>
          <button type="button" className={simStyles.formBtn} onClick={onClose}>Cancel</button>
          <button type="button" className={`${simStyles.formBtn} ${simStyles.formBtnPrimary}`} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }>
      <div className={simStyles.form}>
        <div className={styles.modalMessage} dir="auto">{group.message}</div>
        <label className={simStyles.formField}>
          <span className={simStyles.formLabel}>What was done</span>
          <textarea className={`${simStyles.formArea} ${styles.noteArea}`} dir="auto" value={note} onChange={e => setNote(e.target.value)}
            placeholder="Raised the limit with the provider" maxLength={1000} autoFocus />
        </label>
        <label className={simStyles.formField}>
          <span className={simStyles.formLabel}>Your name</span>
          <input className={simStyles.formInput} value={by} onChange={e => setBy(e.target.value)} placeholder="Your name" />
        </label>
      </div>
    </Modal>
  );
}
