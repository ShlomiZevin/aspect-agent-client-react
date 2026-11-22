/**
 * "תקלות בשיחות עם לקוחות" — the management center's first page (task #985),
 * design round4/opt1 (compact, one desktop screen):
 *   header   the page title + scope · today / this week / a from–to period
 *            (#1001, in the address) · updated + refresh
 *   tiles    real counts, in conversations: needs handling, all fine,
 *            customer conversations, problems, slow replies, problems in test
 *            chats — each opens the conversations page on that category (#1001)
 *   table    every problem — the ones that need handling first — with
 *            "צפייה" opening the conversation window
 *   all      + every agent's status, compact
 * Data + every problem sentence: GET /api/manage/… (builder/services/customerProblems.js).
 */

import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ConversationFilter, CustomerProblem, CustomerProblemsResponse, ProblemPeriod } from '../../../types/manage';
import { ManageApiError, manageService } from '../../../services/manageService';
import type { ManagePageProps } from '../../pages';
import { IconAlert, IconChat, IconCheckCircle, IconClock, IconFlask, IconRefresh } from '../../icons';
import { COPY } from '../../copy';
import { agoText, dateLine } from '../../when';
import { scopePath } from '../../links';
import { periodFromParams, periodKey, periodLabel, periodToParams } from '../../period';
import { ProblemsTable } from './ProblemsTable';
import { AgentsTable } from './AgentsTable';
import { ConversationModal } from '../../components/ConversationModal/ConversationModal';
import { PeriodPicker } from '../../components/PeriodPicker/PeriodPicker';
import s from './CustomerProblemsPage.module.css';

const REFRESH_MS = 2 * 60 * 1000;

type Loaded = { key: string; data?: CustomerProblemsResponse; error?: unknown };

/** A tile — a button that opens the conversations page on its category (#1001). */
function Tile({ label, value, unit, icon, tone, onOpen }: {
  label: string; value: number; unit: string; icon: ReactNode; tone?: 'need' | 'ok'; onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} title={COPY.tileOpenTitle}
      className={`${s.tile} ${s.tileBtn} ${tone === 'need' ? s.tileNeed : tone === 'ok' ? s.tileOk : ''}`}>
      <span className={s.tileLabel}>{icon}{label}</span>
      <span className={s.tileValue}>{value.toLocaleString('he-IL')}</span>
      <span className={s.tileUnit}>{unit}</span>
    </button>
  );
}

export function CustomerProblemsPage({ scope, agentSlug, me }: ManagePageProps) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const period = periodFromParams(params);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [open, setOpen] = useState<CustomerProblem | null>(null);

  const key = `${scope}|${agentSlug}|${periodKey(period)}|${tick}`;

  useEffect(() => {
    let alive = true;
    const load = scope === 'all'
      ? manageService.getAllProblems(period)
      : manageService.getAgentProblems(agentSlug || '', period);
    load
      .then(data => { if (alive) { setLoaded({ key, data }); setNow(new Date()); } })
      .catch(error => { if (alive) setLoaded({ key, error }); });
    return () => { alive = false; };
    // `key` carries every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A quiet refresh every two minutes — a dashboard left open stays true.
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  const current = loaded && loaded.key === key ? loaded : null;
  // Keep showing the previous numbers while a refresh / range switch loads.
  const data = current?.data || (loaded?.data && loaded.data.scope === scope ? loaded.data : undefined);
  const loading = !current;
  const error = current?.error;

  const setPeriod = (p: ProblemPeriod) => setParams(periodToParams(p, params), { replace: true });
  // A tile → the conversations page, same scope and period, filtered (#1001).
  const openConversations = (filter: ConversationFilter) => {
    const sp = periodToParams(period);
    if (filter !== 'all') sp.set('filter', filter);
    const q = sp.toString();
    navigate(`${scopePath(scope === 'all' ? 'all' : agentSlug || '', 'conversations')}${q ? `?${q}` : ''}`);
  };

  const scopeName = scope === 'all' ? COPY.allAgents : (me.agents.find(a => a.slug === agentSlug)?.name || data?.agent?.name || agentSlug || '');
  const problems = data?.problems || [];
  const counts = data?.conversationCounts;
  const unit = periodLabel(period, now);

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titleBlock}>
          <h1 className={s.title}>{COPY.problemsMenu}</h1>
          <span className={s.scopeName} dir="auto">{scopeName}</span>
        </div>
        <div className={s.controls}>
          <PeriodPicker period={period} onChange={setPeriod} now={now} />
          <span className={s.date}>{dateLine(now)}</span>
          <button type="button" className={s.refresh} onClick={() => setTick(n => n + 1)} title={COPY.refresh}>
            <IconRefresh size={14} className={loading ? s.spin : undefined} />
            <span>{COPY.updated} {data ? agoText(data.checkedAt, now) : '…'}</span>
          </button>
        </div>
      </header>

      {error && !data ? (
        <div className={s.message}>
          {error instanceof ManageApiError && error.code === 'no_agent' ? COPY.noAgentAccess : COPY.loadFailed}
        </div>
      ) : !data || !counts ? (
        <div className={s.message}>{COPY.loading}</div>
      ) : (
        <>
          <section className={s.tiles} aria-label={COPY.problemsMenu}>
            <Tile tone="need" label={COPY.kpiNeed} value={counts.act} unit={COPY.unitConversations} icon={<IconAlert size={14} />} onOpen={() => openConversations('act')} />
            <Tile tone="ok" label={COPY.kpiOk} value={counts.ok} unit={COPY.unitConversations} icon={<IconCheckCircle size={14} />} onOpen={() => openConversations('ok')} />
            <Tile label={COPY.kpiServed} value={counts.all} unit={unit} icon={<IconChat size={14} />} onOpen={() => openConversations('all')} />
            <Tile label={COPY.kpiProblems} value={counts.problems} unit={unit} icon={<IconAlert size={14} />} onOpen={() => openConversations('problems')} />
            <Tile label={COPY.kpiSlow} value={counts.slow} unit={COPY.unitSlow} icon={<IconClock size={14} />} onOpen={() => openConversations('slow')} />
            <Tile label={COPY.kpiTest} value={counts.test} unit={COPY.unitTest} icon={<IconFlask size={14} />} onOpen={() => openConversations('test')} />
          </section>

          <div className={`${s.lower} ${scope === 'all' ? s.lowerAll : ''} ${loading ? s.stale : ''}`}>
            <ProblemsTable
              problems={problems}
              now={now}
              showAgent={scope === 'all'}
              range={period.range}
              onShowWeek={() => setPeriod({ range: 'week' })}
              onOpen={setOpen}
            />
            {scope === 'all' && <AgentsTable agents={data.agents} periodText={unit} />}
          </div>
        </>
      )}

      {open && <ConversationModal problem={open} canInvestigate={me.all} now={now} onClose={() => setOpen(null)} />}
    </div>
  );
}
