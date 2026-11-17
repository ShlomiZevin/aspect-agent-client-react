/**
 * One customer problem (task #985, design D): who and when on the right, what
 * happened + the customer's last message + how it ended + the "what to do"
 * chip in the middle, the way into the conversation on the left. Every
 * sentence comes from the server.
 */

import { Link } from 'react-router-dom';
import type { CustomerProblem } from '../../../types/manage';
import { IconCheckSolid, IconChevronLeft, IconClock, IconPerson, IconPhone } from '../../icons';
import { COPY } from '../../copy';
import { whenText } from '../../when';
import { conversationHref, errorsHref } from '../../links';
import s from './ProblemRow.module.css';

export function ProblemRow({ p, now, showAgent }: { p: CustomerProblem; now: Date; showAgent: boolean }) {
  const ok = p.action.tone === 'ok';
  return (
    <article className={s.row}>
      <div className={s.who}>
        <span className={s.customer}>{p.customerName || (p.conversationId ? COPY.customerNo(p.conversationId) : '')}</span>
        <span className={s.time}><IconClock size={16} />{whenText(p.at, now)}</span>
        {showAgent && <span className={s.agent}>{p.agentName}</span>}
        {p.audience === 'test' && <span className={s.testTag}>{COPY.testTag}</span>}
      </div>

      <div className={s.what}>
        <h4 className={s.title}>{p.title}</h4>
        {p.lastCustomerMessage && (
          <>
            <div className={s.saidLabel}>{COPY.lastMessage}</div>
            {/* dir=auto: an English / LTR message is clipped at its END; Hebrew as before. */}
            <p className={s.said} dir="auto">{p.lastCustomerMessage}</p>
          </>
        )}
        <div className={s.foot}>
          <span className={`${s.chip} ${ok ? s.chipOk : s.chipAct}`}>
            {ok ? <IconCheckSolid size={18} /> : p.action.id === 'shlomi' ? <IconPerson size={18} /> : <IconPhone size={18} />}
            {p.action.text}
          </span>
          <span className={s.outcome}>{p.outcome}</span>
        </div>
      </div>

      <div className={s.go}>
        {p.conversationId && (
          <Link className={s.open} to={conversationHref(p)}>
            {COPY.openConversation}
            <IconChevronLeft size={17} />
          </Link>
        )}
        {p.type === 'error' && <Link className={s.tech} to={errorsHref(p)}>{COPY.technical}</Link>}
      </div>
    </article>
  );
}
