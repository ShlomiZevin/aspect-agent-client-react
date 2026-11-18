/**
 * The "צפייה" window (task #985): one problem and its conversation's basic
 * facts — who, when, how many messages, which phase it is in, real or test,
 * and the last few messages as the customer saw them
 * (GET /api/manage/agents/:slug/conversations/:id). The Lybi team also gets
 * "חקירה ב-Builder", which opens the Builder on that conversation in a new tab.
 */

import { useEffect, useRef, useState } from 'react';
import type { CustomerProblem, ManageConversation } from '../../../types/manage';
import { manageService } from '../../../services/manageService';
import { IconClose, IconExternal } from '../../icons';
import { COPY } from '../../copy';
import { shortWhen } from '../../when';
import { builderConversationHref } from '../../links';
import s from './ConversationModal.module.css';

interface Props {
  problem: CustomerProblem;
  /** The Lybi team (every-agent grant) — sees the Builder link. */
  canInvestigate: boolean;
  now: Date;
  onClose: () => void;
}

type Loaded = { data?: ManageConversation; error?: boolean };

export function ConversationModal({ problem: p, canInvestigate, now, onClose }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const act = p.action.tone === 'act';

  useEffect(() => {
    if (!p.conversationId) return;
    let alive = true;
    manageService.getConversation(p.agentSlug, p.conversationId)
      .then(data => { if (alive) setLoaded({ data }); })
      .catch(() => { if (alive) setLoaded({ error: true }); });
    return () => { alive = false; };
  }, [p.agentSlug, p.conversationId]);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const c = loaded?.data;
  const customer = c?.customerName || p.customerName || (p.conversationId ? COPY.customerNo(p.conversationId) : COPY.kind[p.type]);
  const audience = c?.audience || p.audience;

  return (
    <div className={s.backdrop} data-manage-root dir="rtl" lang="he" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="manage-conv-title">
        <header className={s.head}>
          <div className={s.headText}>
            <h2 id="manage-conv-title" className={s.title}>{customer}</h2>
            <div className={s.headMeta}>
              {p.conversationId && <span>{COPY.conversationNo(p.conversationId)}</span>}
              <span dir="auto">{p.agentName}</span>
              {audience && (
                <span className={audience === 'real' ? s.tagReal : s.tagTest}>
                  {audience === 'real' ? COPY.realCustomer : COPY.testConversation}
                </span>
              )}
            </div>
          </div>
          <button ref={closeBtn} type="button" className={s.close} onClick={onClose} aria-label={COPY.close}>
            <IconClose size={16} />
          </button>
        </header>

        <div className={s.body}>
          <section className={`${s.problem} ${act ? s.problemAct : ''}`}>
            <div className={s.problemTitle}>{p.title}</div>
            <div className={s.problemChips}>
              <span className={`${s.chip} ${act ? s.chipAct : s.chipOk}`}>{p.action.text}</span>
              <span className={s.outcome}>{p.outcome}</span>
            </div>
            <div className={s.problemWhen}>{COPY.fWhen}: {shortWhen(p.at, now)}</div>
          </section>

          {!p.conversationId ? (
            <p className={s.quiet}>{COPY.noConversation}</p>
          ) : !loaded ? (
            <p className={s.quiet}>{COPY.convLoading}</p>
          ) : loaded.error || !c ? (
            <p className={s.quiet}>{COPY.convFailed}</p>
          ) : (
            <>
              <dl className={s.facts}>
                <div><dt>{COPY.fStarted}</dt><dd>{shortWhen(c.startedAt, now)}</dd></div>
                <div><dt>{COPY.fLast}</dt><dd>{shortWhen(c.lastActivityAt, now)}</dd></div>
                <div><dt>{COPY.fMessages}</dt><dd>{COPY.fMessagesValue(c.messageCount, c.customerMessages)}</dd></div>
                <div><dt>{COPY.fPhase}</dt><dd dir="auto">{c.phase || '—'}</dd></div>
                <div><dt>{COPY.fAgent}</dt><dd dir="auto">{c.agentName}</dd></div>
                <div><dt>{COPY.fKind}</dt><dd>{c.audience === 'real' ? COPY.realCustomer : COPY.testConversation}</dd></div>
              </dl>

              <section className={s.messages}>
                <h3 className={s.messagesTitle}>{COPY.lastMessages}</h3>
                {c.messages.length === 0 ? (
                  <p className={s.quiet}>{COPY.noMessages}</p>
                ) : (
                  <ol className={s.thread}>
                    {c.messages.map((m, i) => (
                      <li key={i} className={m.role === 'customer' ? s.msgCustomer : s.msgAgent}>
                        <span className={s.msgWho}>{m.role === 'customer' ? COPY.roleCustomer : COPY.roleAgent} · {shortWhen(m.at, now)}</span>
                        <p className={s.msgText} dir="auto">{m.text}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>

        <footer className={s.foot}>
          {canInvestigate && p.conversationId && (
            <a className={s.investigate} href={builderConversationHref(p.agentSlug, p.conversationId)} target="_blank" rel="noopener noreferrer">
              <IconExternal size={14} />
              {COPY.investigate}
            </a>
          )}
          <button type="button" className={s.closeBtn} onClick={onClose}>{COPY.close}</button>
        </footer>
      </div>
    </div>
  );
}
