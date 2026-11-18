/**
 * "תקלות בשיחות עם לקוחות" — the management center's first page (task #985),
 * design round4/opt1 (compact, one desktop screen):
 *   header   the page title + scope · today / this week · updated + refresh
 *   tiles    real counts only: needs handling, all fine, customer
 *            conversations, problems, slow replies, problems in test chats
 *   table    every problem — the ones that need handling first — with
 *            "צפייה" opening the conversation window
 *   all      + every agent's status, compact
 * Data + every problem sentence: GET /api/manage/… (builder/services/customerProblems.js).
 */

import { useEffect, useState, type ReactNode } from 'react';
import type { CustomerProblem, CustomerProblemsResponse, ProblemRange } from '../../../types/manage';
import { ManageApiError, manageService } from '../../../services/manageService';
import type { ManagePageProps } from '../../pages';
import { IconAlert, IconChat, IconCheckCircle, IconClock, IconFlask, IconRefresh } from '../../icons';
import { COPY } from '../../copy';
import { agoText, dateLine } from '../../when';
import { ProblemsTable } from './ProblemsTable';
import { AgentsTable } from './AgentsTable';
import { ConversationModal } from '../../components/ConversationModal/ConversationModal';
import s from './CustomerProblemsPage.module.css';

const REFRESH_MS = 2 * 60 * 1000;

type Loaded = { key: string; data?: CustomerProblemsResponse; error?: unknown };

function Tile({ label, value, unit, icon, tone }: {
  label: string; value: number; unit: string; icon: ReactNode; tone?: 'need' | 'ok';
}) {
  return (
    <div className={`${s.tile} ${tone === 'need' ? s.tileNeed : tone === 'ok' ? s.tileOk : ''}`}>
      <span className={s.tileLabel}>{icon}{label}</span>
      <span className={s.tileValue}>{value.toLocaleString('he-IL')}</span>
      <span className={s.tileUnit}>{unit}</span>
    </div>
  );
}

export function CustomerProblemsPage({ scope, agentSlug, me }: ManagePageProps) {
  const [range, setRange] = useState<ProblemRange>('today');
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [open, setOpen] = useState<CustomerProblem | null>(null);

  const key = `${scope}|${agentSlug}|${range}|${tick}`;

  useEffect(() => {
    let alive = true;
    const load = scope === 'all'
      ? manageService.getAllProblems(range)
      : manageService.getAgentProblems(agentSlug || '', range);
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

  const scopeName = scope === 'all' ? COPY.allAgents : (me.agents.find(a => a.slug === agentSlug)?.name || data?.agent?.name || agentSlug || '');
  const problems = data?.problems || [];
  const act = problems.filter(p => p.action.tone === 'act');
  // Conversations, not rows: one customer may have had two problems.
  const needConversations = new Set(act.map(p => p.conversationId ?? p.id)).size;
  const scopeAgents = data ? (scope === 'all' ? data.agents : data.agents.filter(a => a.slug === agentSlug)) : [];
  const served = scopeAgents.reduce((n, a) => n + a.conversations, 0);
  const okConversations = Math.max(served - needConversations, 0);
  const slowCount = problems.filter(p => p.type === 'slow_reply').length;
  const testCount = problems.filter(p => p.audience === 'test').length;

  return (
    <div className={s.page}>
      <header className={s.head}>
        <div className={s.titleBlock}>
          <h1 className={s.title}>{COPY.problemsMenu}</h1>
          <span className={s.scopeName} dir="auto">{scopeName}</span>
        </div>
        <div className={s.controls}>
          <div className={s.toggle} role="tablist">
            {(['today', 'week'] as ProblemRange[]).map(r => (
              <button key={r} type="button" role="tab" aria-selected={range === r}
                className={`${s.toggleBtn} ${range === r ? s.toggleOn : ''}`} onClick={() => setRange(r)}>
                {r === 'today' ? COPY.today : COPY.week}
              </button>
            ))}
          </div>
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
      ) : !data ? (
        <div className={s.message}>{COPY.loading}</div>
      ) : (
        <>
          <section className={s.tiles} aria-label={COPY.problemsMenu}>
            <Tile tone="need" label={COPY.kpiNeed} value={needConversations} unit={COPY.unitConversations} icon={<IconAlert size={14} />} />
            <Tile tone="ok" label={COPY.kpiOk} value={okConversations} unit={COPY.unitConversations} icon={<IconCheckCircle size={14} />} />
            <Tile label={COPY.kpiServed} value={served} unit={range === 'today' ? COPY.today : COPY.week} icon={<IconChat size={14} />} />
            <Tile label={COPY.kpiProblems} value={problems.length} unit={range === 'today' ? COPY.today : COPY.week} icon={<IconAlert size={14} />} />
            <Tile label={COPY.kpiSlow} value={slowCount} unit={COPY.unitSlow} icon={<IconClock size={14} />} />
            <Tile label={COPY.kpiTest} value={testCount} unit={COPY.unitTest} icon={<IconFlask size={14} />} />
          </section>

          <div className={`${s.lower} ${scope === 'all' ? s.lowerAll : ''} ${loading ? s.stale : ''}`}>
            <ProblemsTable
              problems={problems}
              now={now}
              showAgent={scope === 'all'}
              range={range}
              onShowWeek={() => setRange('week')}
              onOpen={setOpen}
            />
            {scope === 'all' && <AgentsTable agents={data.agents} range={range} />}
          </div>
        </>
      )}

      {open && <ConversationModal problem={open} canInvestigate={me.all} now={now} onClose={() => setOpen(null)} />}
    </div>
  );
}
