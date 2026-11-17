/**
 * "תקלות בשיחות עם לקוחות" — the management center's first page (task #985),
 * design D (round3/D-agent-sunburst.jpg, D-all-sunburst.jpg):
 *   masthead     the world's name (all agents / the agent) + its tag + the date
 *   controls     today / this week, and in "all" the agent filter
 *   headline     one plain sentence on the state + the two count boxes
 *   lists        "השיחות שדורשות טיפול", then the ones that need nothing
 *   side         "במבט מהיר" — only numbers we really have
 *   all world    "<today> בסוכנים" — each agent's conversations and problems
 * Data + every problem sentence: GET /api/manage/… (builder/services/customerProblems.js).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CustomerProblem, CustomerProblemsResponse, ManageAgentSummary, ProblemRange } from '../../../types/manage';
import { manageService } from '../../../services/manageService';
import type { ManagePageProps } from '../../pages';
import { IconAlertCircle, IconBuilding, IconCheckCircle, IconCheckSolid, IconChevronDown, IconChevronLeft, IconRefresh } from '../../icons';
import { COPY } from '../../copy';
import { checkedText, dateLine } from '../../when';
import { ProblemRow } from './ProblemRow';
import s from './CustomerProblemsPage.module.css';

const REFRESH_MS = 2 * 60 * 1000;
const EARLIER_MAX = 5;

type Loaded = { key: string; data?: CustomerProblemsResponse; error?: string };

function load(scope: 'agent' | 'all', agentSlug: string | null, range: ProblemRange, filter: string) {
  return scope === 'all'
    ? manageService.getAllProblems(range, filter || null)
    : manageService.getAgentProblems(agentSlug || '', range);
}

function AgentsCard({ agents, when }: { agents: ManageAgentSummary[]; when: string }) {
  return (
    <section className={s.card}>
      <header className={s.cardHead}>
        <h3 className={s.cardTitle}>{COPY.agentsTitle(when)}</h3>
        <p className={s.cardSub}>{COPY.agentsSub}</p>
      </header>
      <div className={s.cardBody}>
        {agents.map(a => (
          <Link key={a.slug} to={`/manage/${encodeURIComponent(a.slug)}/customer-problems`} className={s.agentRow}>
            <span className={s.agentIcon}><IconBuilding size={34} /></span>
            <span className={s.agentText}>
              <span className={s.agentName}>{a.name}</span>
              <span className={s.agentLine}>{COPY.agentLine(a.conversations, a.problems)}</span>
            </span>
            {a.needsAction > 0
              ? <span className={`${s.agentStatus} ${s.agentStatusAct}`}>{COPY.statusAct(a.needsAction)}</span>
              : <span className={`${s.agentStatus} ${s.agentStatusOk}`}><IconCheckSolid size={17} />{COPY.statusOk}</span>}
            <IconChevronLeft size={22} className={s.agentChevron} />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CustomerProblemsPage({ scope, agentSlug }: ManagePageProps) {
  const [range, setRange] = useState<ProblemRange>('today');
  const [filter, setFilter] = useState('');
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [earlier, setEarlier] = useState<{ key: string; problems: CustomerProblem[] } | null>(null);

  const key = `${scope}|${agentSlug}|${range}|${filter}|${tick}`;

  useEffect(() => {
    let alive = true;
    load(scope, agentSlug, range, filter)
      .then(data => { if (alive) { setLoaded({ key, data }); setNow(new Date()); } })
      .catch(err => { if (alive) setLoaded({ key, error: err instanceof Error ? err.message : String(err) }); });
    return () => { alive = false; };
    // `key` carries every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A quiet refresh every two minutes — a dashboard left open stays true.
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  const data = loaded?.data;
  const loading = !loaded || loaded.key !== key;
  const error = loaded && loaded.key === key ? loaded.error : undefined;

  // A calm today → also show what happened earlier this week.
  const calmToday = !!data && data.range === 'today' && data.problems.length === 0 && loaded?.key === key;
  useEffect(() => {
    if (!calmToday || !data) return;
    let alive = true;
    const todayFrom = new Date(data.from).getTime();
    load(scope, agentSlug, 'week', filter)
      .then(w => {
        if (alive) setEarlier({ key, problems: w.problems.filter(p => new Date(p.at).getTime() < todayFrom).slice(0, EARLIER_MAX) });
      })
      .catch(() => { /* the calm headline is enough */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calmToday, key]);

  const when = range === 'today' ? COPY.todayWord : COPY.weekWord;
  const worldName = scope === 'all' ? COPY.allAgents : (data?.agent?.name || agentSlug || '');
  const worldTag = scope === 'all' ? COPY.allAgentsSub : (agentSlug || '');

  const problems = data?.problems || [];
  const act = problems.filter(p => p.action.tone === 'act');
  const fine = problems.filter(p => p.action.tone === 'ok');
  // Conversations, not rows: one customer may have had two problems.
  const needConversations = new Set(act.map(p => p.conversationId ?? p.id)).size;
  const scopeAgents = data ? (scope === 'all' && filter ? data.agents.filter(a => a.slug === filter) : data.agents) : [];
  const served = scopeAgents.reduce((n, a) => n + a.conversations, 0);
  const okConversations = Math.max(served - needConversations, 0);
  const slowCount = problems.filter(p => p.type === 'slow_reply').length;
  const testCount = problems.filter(p => p.audience === 'test').length;
  const earlierRows = earlier && earlier.key === key ? earlier.problems : [];
  const agentOptions = (data?.agents || []).filter(a => !a.archived || a.slug === filter);
  // Agents that talked to customers or had a problem in the range (D-all lists the active ones).
  const shownAgents = scopeAgents.filter(a => a.conversations > 0 || a.problems > 0);
  const showActCard = problems.length > 0 || (scope === 'agent' && earlierRows.length === 0);

  return (
    <div className={s.page}>
      <section className={s.masthead}>
        <div className={s.mastTop}>
          <span className={s.kicker}>{COPY.kicker}</span>
          <span className={s.date}>{dateLine(now)}</span>
        </div>
        <div className={s.mastRow}>
          <h1 className={s.worldTitle}>{worldName}</h1>
          <span className={s.ribbon} dir={scope === 'agent' ? 'ltr' : undefined}>{worldTag}</span>
        </div>
        <div className={s.rule} aria-hidden />
      </section>

      <div className={s.controls}>
        <div className={s.toggle} role="tablist">
          {(['today', 'week'] as ProblemRange[]).map(r => (
            <button key={r} type="button" role="tab" aria-selected={range === r}
              className={`${s.toggleBtn} ${range === r ? s.toggleOn : ''}`} onClick={() => setRange(r)}>
              {r === 'today' ? COPY.today : COPY.week}
            </button>
          ))}
        </div>
        {scope === 'all' && (
          <label className={s.filter}>
            <span className={s.filterLabel}>{COPY.agentFilterLabel}</span>
            <span className={s.selectWrap}>
              <select className={s.select} value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="">{COPY.allAgents}</option>
                {agentOptions.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
              </select>
              <IconChevronDown size={18} className={s.selectChevron} />
            </span>
          </label>
        )}
        <button type="button" className={s.checked} onClick={() => setTick(n => n + 1)} title={COPY.refresh}>
          <span>{COPY.checkedAt} {data ? checkedText(data.checkedAt, now) : '…'}</span>
          <IconRefresh size={19} className={loading ? s.spin : undefined} />
        </button>
      </div>

      {error ? (
        <div className={s.message}>{/^No agent/.test(error) ? COPY.noAgent : COPY.loadFailed}</div>
      ) : !data ? (
        <div className={s.message}>{COPY.loading}</div>
      ) : (
        <div className={`${s.content} ${loading ? s.contentLoading : ''}`}>
          <section className={s.headline}>
            <div className={`${s.headText} ${needConversations > 0 ? '' : s.headTextCalm}`}>
              <span className={s.headTag}>{COPY.headlineTag}</span>
              {needConversations > 0 ? (
                <>
                  <h2 className={s.headTitle}>{needConversations === 1 ? COPY.needOne : COPY.needMany(needConversations)}</h2>
                  <p className={s.headSub}>{COPY.needSub(served, needConversations, when)}</p>
                </>
              ) : (
                <>
                  <h2 className={`${s.headTitle} ${s.headCalm}`}>
                    <IconCheckSolid size={46} />
                    {COPY.calmTitle(range === 'today' ? COPY.today : COPY.week)}
                  </h2>
                  <p className={s.headSub}>
                    {problems.length > 0 ? COPY.calmSmallSub(problems.length) : COPY.calmSub(scope === 'all' ? COPY.scopeAll : COPY.scopeAgent)}
                  </p>
                </>
              )}
            </div>
            <div className={s.boxes}>
              <div className={`${s.box} ${s.boxNeed}`}>
                <span className={s.boxIcon}><IconAlertCircle size={40} /></span>
                <span className={s.boxText}>
                  <span className={s.boxLabel}>{COPY.boxNeed}</span>
                  <span className={s.boxValue}>{COPY.conversations(needConversations)}</span>
                </span>
              </div>
              <div className={`${s.box} ${s.boxOk}`}>
                <span className={s.boxIcon}><IconCheckCircle size={40} /></span>
                <span className={s.boxText}>
                  <span className={s.boxLabel}>{COPY.boxOk}</span>
                  <span className={s.boxValue}>{COPY.conversations(okConversations)}</span>
                </span>
              </div>
            </div>
          </section>

          <div className={s.lower}>
            <div className={s.mainCol}>
              {showActCard && (
                <section className={`${s.card} ${s.cardNeed}`}>
                  <header className={`${s.cardHead} ${s.cardHeadNeed}`}>
                    <h3 className={s.cardTitle}>{COPY.listNeedTitle} ({act.length})</h3>
                  </header>
                  <div className={s.cardBody}>
                    {act.length
                      ? act.map(p => <ProblemRow key={p.id} p={p} now={now} showAgent={scope === 'all'} />)
                      : <div className={s.empty}><IconCheckSolid size={22} />{COPY.listNeedEmpty}</div>}
                  </div>
                </section>
              )}

              {fine.length > 0 && (
                <section className={s.card}>
                  <header className={s.cardHead}>
                    <h3 className={s.cardTitle}>{COPY.listOkTitle} ({fine.length})</h3>
                  </header>
                  <div className={s.cardBody}>
                    {fine.map(p => <ProblemRow key={p.id} p={p} now={now} showAgent={scope === 'all'} />)}
                  </div>
                </section>
              )}

              {problems.length === 0 && earlierRows.length > 0 && (
                <section className={s.card}>
                  <header className={s.cardHead}>
                    <h3 className={s.cardTitle}>{COPY.earlierTitle}</h3>
                  </header>
                  <div className={s.cardBody}>
                    {earlierRows.map(p => <ProblemRow key={p.id} p={p} now={now} showAgent={scope === 'all'} />)}
                  </div>
                </section>
              )}

              {scope === 'all' && shownAgents.length > 0 && <AgentsCard agents={shownAgents} when={range === 'today' ? COPY.today : COPY.week} />}
            </div>

            <aside className={s.quick}>
              <header className={s.quickHead}>
                <h3 className={s.quickTitle}>{COPY.quickTitle}</h3>
                <p className={s.quickSub}>{COPY.quickSub(range === 'today' ? COPY.today : COPY.week, scope === 'all' && !filter ? COPY.allAgents : (filter ? (scopeAgents[0]?.name || filter) : worldName))}</p>
              </header>
              <dl className={s.quickList}>
                <div className={s.quickRow}><dt>{COPY.quickConversations}</dt><dd>{served}</dd></div>
                <div className={s.quickRow}><dt>{COPY.quickProblems}</dt><dd>{problems.length}</dd></div>
                <div className={s.quickRow}><dt>{COPY.quickSlow}</dt><dd>{slowCount}</dd></div>
                <div className={s.quickRow}><dt>{COPY.quickTest}</dt><dd>{testCount}</dd></div>
              </dl>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
