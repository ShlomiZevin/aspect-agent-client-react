/**
 * "שיחות" — every customer conversation of a period (#1001), newest first:
 * time · agent (all only) · what happened (the problem's sentence and
 * detail, or "no problems") with the customer and their last message ·
 * kind · status (תקין / הייתה תקלה / דורש טיפול) · "צפייה" (the conversation window).
 *
 * The period is the same toggle as the problems page, in the address. The
 * problems page's tiles open this page with `?filter=` (act · ok · problems ·
 * slow · test); the active filter shows on the card and clears in one click.
 * Same look as the problems page (its CSS module). Data:
 * GET /api/manage/…/conversations (customerProblems.listConversations).
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type {
  ConversationFilter, CustomerProblem, ManageConversationRow, ManageConversationsResponse, ProblemPeriod,
} from '../../../types/manage';
import { ManageApiError, manageService } from '../../../services/manageService';
import type { ManagePageProps } from '../../pages';
import { IconCheckCircle, IconClose, IconRefresh } from '../../icons';
import { COPY } from '../../copy';
import { agoText, dateLine, shortWhen } from '../../when';
import { periodFromParams, periodKey, periodToParams } from '../../period';
import { ConversationModal, type ConversationRef } from '../../components/ConversationModal/ConversationModal';
import { PeriodPicker } from '../../components/PeriodPicker/PeriodPicker';
import p from '../CustomerProblemsPage/CustomerProblemsPage.module.css';
import s from './ConversationsPage.module.css';

const REFRESH_MS = 2 * 60 * 1000;
const FILTERS: ConversationFilter[] = ['all', 'act', 'ok', 'problems', 'slow', 'test'];
/** A filter's name = the tile it came from. */
const FILTER_NAME: Record<ConversationFilter, string> = {
  all: COPY.filterAll, act: COPY.kpiNeed, ok: COPY.kpiOk, problems: COPY.kpiProblems, slow: COPY.kpiSlow, test: COPY.kpiTest,
};
const KIND_CLASS: Record<string, string> = { error: p.kindError, no_reply: p.kindNoReply, slow_reply: p.kindSlow };

type Loaded = { key: string; data?: ManageConversationsResponse; error?: unknown };
type Open = { problem: CustomerProblem } | { conversation: ConversationRef };

const filterOf = (sp: URLSearchParams): ConversationFilter => {
  const f = sp.get('filter') as ConversationFilter | null;
  return f && FILTERS.includes(f) ? f : 'all';
};

/** The rows a filter keeps — the same rule as the tile's number (customerProblems.tally). */
function keep(f: ConversationFilter, c: ManageConversationRow, probs: CustomerProblem[]): boolean {
  switch (f) {
    case 'act': return c.status === 'act';
    case 'ok': return c.status !== 'act';
    case 'problems': return c.problemIds.length > 0;
    case 'slow': return probs.some(x => x.type === 'slow_reply');
    case 'test': return c.audience === 'test' && c.problemIds.length > 0;
    default: return true;
  }
}

function Row({ c, lead, more, now, showAgent, onOpen }: {
  c: ManageConversationRow; lead: CustomerProblem | null; more: number; now: Date; showAgent: boolean; onOpen: () => void;
}) {
  const customer = c.customerName || (c.conversationId ? COPY.customerNo(c.conversationId) : null);
  const state = c.status === 'act'
    ? { text: COPY.convAct, cls: p.statusAct }
    : c.status === 'info' ? { text: COPY.convInfo, cls: s.statusInfo } : { text: COPY.convOk, cls: p.statusOk };
  return (
    <tr className={c.status === 'act' ? p.rowAct : undefined}>
      <td className={p.cTime}>{shortWhen(c.at, now)}</td>
      {showAgent && <td className={p.cAgent}><span className={p.clip} dir="auto" title={c.agentName}>{c.agentName}</span></td>}
      <td className={p.cWhat}>
        {lead ? (
          <span className={p.what} title={lead.title}>
            {lead.title}
            {more > 0 && <span className={s.more}>{COPY.moreProblems(more)}</span>}
          </span>
        ) : (
          <span className={`${p.what} ${s.whatOk}`}>{COPY.rowOk}</span>
        )}
        {lead?.detail && <span className={p.detail} title={lead.detail}>{lead.detail}</span>}
        <span className={p.whatSub}>
          {customer && <span className={p.customer}>{customer}</span>}
          {c.audience === 'test' && <span className={p.testTag}>{COPY.testTag}</span>}
          {c.audience === 'real' && <span className={s.realTag}>{COPY.realCustomer}</span>}
          {c.conversationId && c.customerName && <span className={s.convNo}>{COPY.conversationNo(c.conversationId)}</span>}
          {c.lastCustomerMessage && <span className={p.said} dir="auto">“{c.lastCustomerMessage}”</span>}
        </span>
      </td>
      <td className={p.cKind}>{lead && <span className={`${p.kind} ${KIND_CLASS[lead.type] || ''}`}>{COPY.kind[lead.type] || lead.type}</span>}</td>
      <td className={p.cStatus}><span className={`${p.status} ${state.cls}`} title={lead?.action.text}>{state.text}</span></td>
      <td className={p.cGo}><button type="button" className={p.view} onClick={onOpen}>{COPY.view}</button></td>
    </tr>
  );
}

export function ConversationsPage({ scope, agentSlug, me }: ManagePageProps) {
  const [params, setParams] = useSearchParams();
  const period = periodFromParams(params);
  const filter = filterOf(params);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [open, setOpen] = useState<Open | null>(null);

  const key = `${scope}|${agentSlug}|${periodKey(period)}|${tick}`;

  useEffect(() => {
    let alive = true;
    const load = scope === 'all'
      ? manageService.getAllConversations(period)
      : manageService.getAgentConversations(agentSlug || '', period);
    load
      .then(data => { if (alive) { setLoaded({ key, data }); setNow(new Date()); } })
      .catch(error => { if (alive) setLoaded({ key, error }); });
    return () => { alive = false; };
    // `key` carries every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  const current = loaded && loaded.key === key ? loaded : null;
  // Keep showing the previous rows while a refresh / period switch loads.
  const data = current?.data || (loaded?.data && loaded.data.scope === scope ? loaded.data : undefined);
  const loading = !current;
  const error = current?.error;

  const byId = useMemo(() => new Map((data?.problems || []).map(x => [x.id, x])), [data]);
  const probsOf = (c: ManageConversationRow) => c.problemIds.map(id => byId.get(id)).filter((x): x is CustomerProblem => !!x);
  const rows = (data?.conversations || []).filter(c => keep(filter, c, probsOf(c)));
  const count = data ? (filter === 'all' ? data.conversationCounts.all : data.conversationCounts[filter]) : 0;

  const setPeriod = (x: ProblemPeriod) => setParams(periodToParams(x, params), { replace: true });
  const clearFilter = () => { const sp = new URLSearchParams(params); sp.delete('filter'); setParams(sp, { replace: true }); };
  const openRow = (c: ManageConversationRow) => {
    const lead = c.problemIds.length ? byId.get(c.problemIds[0]) : undefined;
    setOpen(lead ? { problem: lead } : {
      conversation: { agentSlug: c.agentSlug, agentName: c.agentName, conversationId: c.conversationId, customerName: c.customerName, audience: c.audience },
    });
  };

  const scopeName = scope === 'all' ? COPY.allAgents : (me.agents.find(a => a.slug === agentSlug)?.name || agentSlug || '');
  const showAgent = scope === 'all';
  const cols = showAgent ? 6 : 5;

  return (
    <div className={p.page}>
      <header className={p.head}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>{COPY.conversationsTitle}</h1>
          <span className={p.scopeName} dir="auto">{scopeName}</span>
        </div>
        <div className={p.controls}>
          <PeriodPicker period={period} onChange={setPeriod} now={now} />
          <span className={p.date}>{dateLine(now)}</span>
          <button type="button" className={p.refresh} onClick={() => setTick(n => n + 1)} title={COPY.refresh}>
            <IconRefresh size={14} className={loading ? p.spin : undefined} />
            <span>{COPY.updated} {data ? agoText(data.checkedAt, now) : '…'}</span>
          </button>
        </div>
      </header>

      {error && !data ? (
        <div className={p.message}>
          {error instanceof ManageApiError && error.code === 'no_agent' ? COPY.noAgentAccess : COPY.loadFailed}
        </div>
      ) : !data ? (
        <div className={p.message}>{COPY.loading}</div>
      ) : (
        <section className={`${p.card} ${s.card} ${loading ? p.stale : ''}`}>
          <header className={p.cardHead}>
            <h2 className={p.cardTitle}>{COPY.conversationsTitle} <span className={p.count}>({count.toLocaleString('he-IL')})</span></h2>
            {filter !== 'all' && (
              <span className={s.filter}>
                <span className={s.filterLabel}>{COPY.filterLabel}:</span>
                <span className={s.filterName}>{FILTER_NAME[filter]}</span>
                <button type="button" className={s.filterClear} onClick={clearFilter} title={COPY.clearFilter} aria-label={COPY.clearFilter}>
                  <IconClose size={12} />
                </button>
              </span>
            )}
            {data.truncated && <span className={p.cardHint}>{COPY.conversationsTruncated(data.conversations.length)}</span>}
          </header>
          <div className={p.tableWrap}>
            <table className={`${p.table} ${showAgent ? p.withAgent : ''}`}>
              <thead>
                <tr>
                  <th className={p.cTime}>{COPY.colTime}</th>
                  {showAgent && <th className={p.cAgent}>{COPY.colAgent}</th>}
                  <th className={p.cWhat}>{COPY.colWhat}</th>
                  <th className={p.cKind}>{COPY.colKind}</th>
                  <th className={p.cStatus}>{COPY.colConvStatus}</th>
                  <th className={p.cGo}><span className={p.srOnly}>{COPY.view}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr className={p.emptyRow}>
                    <td colSpan={cols}>
                      <span className={p.empty}>
                        <IconCheckCircle size={16} />
                        {filter !== 'all' ? COPY.emptyFilter : period.range === 'today' ? COPY.emptyConversationsToday : COPY.emptyConversations}
                      </span>
                    </td>
                  </tr>
                )}
                {rows.map(c => {
                  const probs = probsOf(c);
                  return (
                    <Row key={c.id} c={c} lead={probs[0] || null} more={Math.max(probs.length - 1, 0)}
                      now={now} showAgent={showAgent} onOpen={() => openRow(c)} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {open && ('problem' in open
        ? <ConversationModal problem={open.problem} canInvestigate={me.all} now={now} onClose={() => setOpen(null)} />
        : <ConversationModal conversation={open.conversation} canInvestigate={me.all} now={now} onClose={() => setOpen(null)} />)}
    </div>
  );
}
