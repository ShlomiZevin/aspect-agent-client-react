/**
 * Every agent's status at a glance — the "all agents" scope only (task #985):
 * agent · customer conversations · problems · status. The name opens that
 * agent's scope. Numbers from the server's `agents[]` (customerProblems.js).
 */

import { Link } from 'react-router-dom';
import type { ManageAgentSummary, ProblemRange } from '../../../types/manage';
import { COPY } from '../../copy';
import { scopePath } from '../../links';
import s from './CustomerProblemsPage.module.css';

export function AgentsTable({ agents, range }: { agents: ManageAgentSummary[]; range: ProblemRange }) {
  // Live agents, plus an archived one only if it still had activity; busiest first.
  const rows = agents
    .filter(a => !a.archived || a.conversations > 0 || a.problems > 0)
    .sort((x, y) => y.needsAction - x.needsAction || y.conversations - x.conversations || x.name.localeCompare(y.name));

  return (
    <section className={`${s.card} ${s.agentsCard}`}>
      <header className={s.cardHead}>
        <h2 className={s.cardTitle}>{COPY.agentsTitle} <span className={s.count}>({rows.length})</span></h2>
        <span className={s.cardHint}>{range === 'today' ? COPY.today : COPY.week}</span>
      </header>
      <div className={s.tableWrap}>
        <table className={`${s.table} ${s.agentsTable}`}>
          <thead>
            <tr>
              <th>{COPY.colAgent}</th>
              <th className={s.num}>{COPY.colConversations}</th>
              <th className={s.num}>{COPY.colProblems}</th>
              <th className={s.cAgentStatus}>{COPY.colAgentStatus}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.slug}>
                <td>
                  <Link to={scopePath(a.slug, 'customer-problems')} className={`${s.agentLink} ${s.clip}`} dir="auto" title={a.name}>{a.name}</Link>
                </td>
                <td className={s.num}>{a.conversations.toLocaleString('he-IL')}</td>
                <td className={s.num}>{a.problems.toLocaleString('he-IL')}</td>
                <td className={s.cAgentStatus}>
                  {a.needsAction > 0
                    ? <span className={`${s.status} ${s.statusAct}`}>{COPY.statusAct(a.needsAction)}</span>
                    : <span className={`${s.status} ${s.statusOk}`}>{COPY.statusOk}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
