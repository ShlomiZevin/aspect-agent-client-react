/**
 * Every customer problem in one compact table (task #985, design round4/opt1):
 * time · agent (all only) · what happened (+ customer and their last
 * message) · kind · what to do · "צפייה". The ones that need handling come
 * first, highlighted; then "לידיעה בלבד". Every sentence is the server's.
 */

import type { CustomerProblem, ProblemRange } from '../../../types/manage';
import { IconCheckCircle } from '../../icons';
import { COPY } from '../../copy';
import { shortWhen } from '../../when';
import s from './CustomerProblemsPage.module.css';

interface Props {
  problems: CustomerProblem[];
  now: Date;
  showAgent: boolean;
  range: ProblemRange;
  onShowWeek: () => void;
  onOpen: (p: CustomerProblem) => void;
}

const KIND_CLASS: Record<string, string> = { error: s.kindError, no_reply: s.kindNoReply, slow_reply: s.kindSlow };

function Row({ p, now, showAgent, onOpen }: { p: CustomerProblem; now: Date; showAgent: boolean; onOpen: (p: CustomerProblem) => void }) {
  const act = p.action.tone === 'act';
  const customer = p.customerName || (p.conversationId ? COPY.customerNo(p.conversationId) : null);
  return (
    <tr className={act ? s.rowAct : undefined}>
      <td className={s.cTime}>{shortWhen(p.at, now)}</td>
      {showAgent && <td className={s.cAgent}><span className={s.clip} dir="auto" title={p.agentName}>{p.agentName}</span></td>}
      <td className={s.cWhat}>
        <span className={s.what} title={p.title}>{p.title}</span>
        {(customer || p.lastCustomerMessage) && (
          <span className={s.whatSub}>
            {customer && <span className={s.customer}>{customer}</span>}
            {p.audience === 'test' && <span className={s.testTag}>{COPY.testTag}</span>}
            {/* dir=auto: an English / LTR message reads and clips from its own start. */}
            {p.lastCustomerMessage && <span className={s.said} dir="auto">“{p.lastCustomerMessage}”</span>}
          </span>
        )}
      </td>
      <td className={s.cKind}><span className={`${s.kind} ${KIND_CLASS[p.type] || ''}`}>{COPY.kind[p.type] || p.type}</span></td>
      <td className={s.cStatus}>
        <span className={`${s.status} ${act ? s.statusAct : s.statusOk}`} title={p.outcome}>{p.action.text}</span>
      </td>
      <td className={s.cGo}>
        <button type="button" className={s.view} onClick={() => onOpen(p)}>{COPY.view}</button>
      </td>
    </tr>
  );
}

export function ProblemsTable({ problems, now, showAgent, range, onShowWeek, onOpen }: Props) {
  const act = problems.filter(p => p.action.tone === 'act');
  const info = problems.filter(p => p.action.tone !== 'act');
  const cols = showAgent ? 6 : 5;

  return (
    <section className={`${s.card} ${s.problemsCard}`}>
      <header className={s.cardHead}>
        <h2 className={s.cardTitle}>{COPY.tableTitle} <span className={s.count}>({problems.length})</span></h2>
      </header>
      <div className={s.tableWrap}>
        <table className={`${s.table} ${showAgent ? s.withAgent : ''}`}>
          <thead>
            <tr>
              <th className={s.cTime}>{COPY.colTime}</th>
              {showAgent && <th className={s.cAgent}>{COPY.colAgent}</th>}
              <th className={s.cWhat}>{COPY.colWhat}</th>
              <th className={s.cKind}>{COPY.colKind}</th>
              <th className={s.cStatus}>{COPY.colStatus}</th>
              <th className={s.cGo}><span className={s.srOnly}>{COPY.view}</span></th>
            </tr>
          </thead>
          <tbody>
            {problems.length === 0 && (
              <tr className={s.emptyRow}>
                <td colSpan={cols}>
                  <span className={s.empty}>
                    <IconCheckCircle size={16} />
                    {range === 'today' ? COPY.emptyToday : COPY.emptyWeek}
                    {range === 'today' && <button type="button" className={s.linkBtn} onClick={onShowWeek}>{COPY.showWeek}</button>}
                  </span>
                </td>
              </tr>
            )}
            {act.length > 0 && (
              <tr className={`${s.groupRow} ${s.groupNeed}`}><td colSpan={cols}>{COPY.groupNeed} ({act.length})</td></tr>
            )}
            {act.map(p => <Row key={p.id} p={p} now={now} showAgent={showAgent} onOpen={onOpen} />)}
            {info.length > 0 && (
              <tr className={s.groupRow}><td colSpan={cols}>{COPY.groupInfo} ({info.length})</td></tr>
            )}
            {info.map(p => <Row key={p.id} p={p} now={now} showAgent={showAgent} onOpen={onOpen} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
