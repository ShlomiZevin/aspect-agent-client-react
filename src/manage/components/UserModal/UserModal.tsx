/**
 * The user window (Users page, #999): one person of the customer chat —
 * phone, email, created, last active, real or test, suspended — and their
 * conversations with this agent. "צפייה" on a conversation opens the
 * conversation window (ConversationModal); closing it comes back here.
 * GET /api/manage/agents/:slug/users/:id. Same frame as the conversation window.
 */

import { useEffect, useRef, useState } from 'react';
import type { ManageUser, ManageUserConversation, ManageUserDetail } from '../../../types/manage';
import { manageService } from '../../../services/manageService';
import { IconClose } from '../../icons';
import { COPY } from '../../copy';
import { shortWhen } from '../../when';
import s from '../ConversationModal/ConversationModal.module.css';
import u from './UserModal.module.css';

interface Props {
  user: ManageUser;
  now: Date;
  onOpenConversation: (c: ManageUserConversation) => void;
  onClose: () => void;
}

type Loaded = { data?: ManageUserDetail; error?: boolean };

export function UserModal({ user, now, onOpenConversation, onClose }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    manageService.getUser(user.agentSlug, user.id)
      .then(data => { if (alive) setLoaded({ data }); })
      .catch(() => { if (alive) setLoaded({ error: true }); });
    return () => { alive = false; };
  }, [user.agentSlug, user.id]);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const p = loaded?.data?.user || user;
  const convs = loaded?.data?.conversations || [];
  const shown = loaded?.data?.shownConversations || 0;

  return (
    <div className={s.backdrop} data-manage-root dir="rtl" lang="he" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-labelledby="manage-user-title">
        <header className={s.head}>
          <div className={s.headText}>
            <h2 id="manage-user-title" className={s.title} dir="auto">{p.name || COPY.noName}</h2>
            <div className={s.headMeta}>
              <span>{COPY.userNo(p.id)}</span>
              <span dir="auto">{p.agentName}</span>
              <span className={p.audience === 'real' ? s.tagReal : s.tagTest}>
                {p.audience === 'real' ? COPY.realCustomer : COPY.testUser}
              </span>
              {p.suspended && <span className={u.tagSuspended}>{COPY.suspendedTag}</span>}
            </div>
          </div>
          <button ref={closeBtn} type="button" className={s.close} onClick={onClose} aria-label={COPY.close}>
            <IconClose size={16} />
          </button>
        </header>

        <div className={s.body}>
          <dl className={s.facts}>
            <div><dt>{COPY.fPhone}</dt><dd dir="ltr" className={u.ltr}>{p.phone || '—'}</dd></div>
            <div><dt>{COPY.fEmail}</dt><dd dir="ltr" className={u.ltr} title={p.email || undefined}>{p.email || '—'}</dd></div>
            <div><dt>{COPY.fConversations}</dt><dd>{p.conversations.toLocaleString('he-IL')}</dd></div>
            <div><dt>{COPY.fCreated}</dt><dd>{shortWhen(p.createdAt, now)}</dd></div>
            <div><dt>{COPY.fLast}</dt><dd>{shortWhen(p.lastActiveAt, now)}</dd></div>
            <div><dt>{COPY.fKind}</dt><dd>{p.audience === 'real' ? COPY.realCustomer : COPY.testUser}</dd></div>
          </dl>

          <section>
            <h3 className={s.messagesTitle}>{COPY.userConversations}</h3>
            {!loaded ? (
              <p className={s.quiet}>{COPY.userLoading}</p>
            ) : loaded.error ? (
              <p className={s.quiet}>{COPY.userFailed}</p>
            ) : convs.length === 0 ? (
              <p className={s.quiet}>{COPY.noUserConversations}</p>
            ) : (
              <>
                <table className={u.table}>
                  <thead>
                    <tr>
                      <th className={u.cNo}>{COPY.colConversation}</th>
                      <th className={u.cWhen}>{COPY.colStarted}</th>
                      <th className={u.cWhen}>{COPY.colLastActive}</th>
                      <th className={u.cNum}>{COPY.colMessages}</th>
                      <th>{COPY.colPhase}</th>
                      <th className={u.cGo}><span className={u.srOnly}>{COPY.view}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {convs.map(c => (
                      <tr key={c.id}>
                        <td className={u.cNo}>{`#${c.id}`}</td>
                        <td className={u.cWhen}>{shortWhen(c.startedAt, now)}</td>
                        <td className={u.cWhen}>{shortWhen(c.lastActivityAt, now)}</td>
                        <td className={u.cNum}>{c.messageCount.toLocaleString('he-IL')}</td>
                        <td><span className={u.clip} dir="auto" title={c.phase || undefined}>{c.phase || '—'}</span></td>
                        <td className={u.cGo}>
                          <button type="button" className={u.view} onClick={() => onOpenConversation(c)}>{COPY.view}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {convs.length >= shown && shown > 0 && <p className={u.note}>{COPY.newestConversations(shown)}</p>}
              </>
            )}
          </section>
        </div>

        <footer className={s.foot}>
          <button type="button" className={s.closeBtn} onClick={onClose}>{COPY.close}</button>
        </footer>
      </div>
    </div>
  );
}
