/**
 * "משתמשים" — the management center's second page (tasks #999, #982, #991).
 * User management only: the people of the agent's customer chat, in two
 * parts — real customers, and test users (the team, scripts) folded below.
 * Every column fits on screen (no column hides under the actions).
 *   row      user (name, email / id) · phone · agent (all only) ·
 *            conversations · created · last active · actions
 *   actions  suspend / reactivate · real customer ↔ test · delete — each
 *            confirmed in ConfirmModal; the same operations as Admin → Users
 *   click    the user window (UserModal) → a conversation (ConversationModal)
 *   add      "הוספת משתמש" (AddUserModal) — name, phone, auto-suspend (#1002)
 *   ⏱ pill   time left to the user's auto-suspend; click → turn it off (ConfirmModal)
 * Data: GET /api/manage/agents/:slug/users · /api/manage/users
 * (builder/services/manageUsers.js). Look: the problems page (its header and
 * card styles are shared) + UsersPage.module.css.
 */

import { useEffect, useState, type MouseEvent } from 'react';
import type { ManageUser, ManageUserConversation, ManageUsersResponse } from '../../../types/manage';
import { ManageApiError, manageService } from '../../../services/manageService';
import type { ManagePageProps } from '../../pages';
import { IconChevronDown, IconClock, IconPause, IconPlay, IconRefresh, IconTrash } from '../../icons';
import { COPY } from '../../copy';
import { agoText, shortWhen } from '../../when';
import { ConversationModal } from '../../components/ConversationModal/ConversationModal';
import { ConfirmModal } from '../../components/ConfirmModal/ConfirmModal';
import { UserModal } from '../../components/UserModal/UserModal';
import { AddUserModal } from '../../components/AddUserModal/AddUserModal';
import p from '../CustomerProblemsPage/CustomerProblemsPage.module.css';
import s from './UsersPage.module.css';

type Loaded = { key: string; data?: ManageUsersResponse; error?: unknown };
type Action = 'suspend' | 'reactivate' | 'real' | 'test' | 'delete' | 'autoOff';

const rowKey = (u: ManageUser) => `${u.id}:${u.agentSlug}`;
const nameOf = (u: ManageUser) => u.name || u.phone || COPY.userNo(u.id);

/**
 * Auto-suspend (#1002): the server's row is as of the load; an auto-suspend
 * time that passes while the page is open turns the row suspended here too
 * (the server enforces it at that same moment).
 */
function liveUser(u: ManageUser, clock: number): ManageUser {
  if (u.suspended || !u.autoSuspendAt || Date.parse(u.autoSuspendAt) > clock) return u;
  return { ...u, suspended: true, suspendedAt: u.autoSuspendAt, autoSuspendAt: null, autoSuspended: true };
}

/** Time left to an auto-suspend, compact: "47 ש׳", "42 ד׳". */
function timeLeft(iso: string, clock: number) {
  const mins = Math.max(1, Math.ceil((Date.parse(iso) - clock) / 60000));
  return mins >= 60 ? COPY.autoLeftHours(Math.floor(mins / 60)) : COPY.autoLeftMinutes(mins);
}

function UserRow({ u, now, showAgent, onOpen, onAction }: {
  u: ManageUser; now: Date; showAgent: boolean;
  onOpen: (u: ManageUser) => void; onAction: (u: ManageUser, a: Action) => void;
}) {
  const locked = u.shared;
  const sub = u.email || (!u.name ? u.externalId : null);
  const act = (a: Action) => (e: MouseEvent) => { e.stopPropagation(); onAction(u, a); };
  return (
    <tr className={`${s.row} ${u.suspended ? s.rowSuspended : ''}`} onClick={() => onOpen(u)}>
      <td className={s.cUser} data-label={COPY.colUser}>
        <button type="button" className={s.userName} dir="auto" title={u.name || undefined} onClick={e => { e.stopPropagation(); onOpen(u); }}>
          {u.name || COPY.noName}
        </button>
        {(sub || u.suspended || u.shared || u.autoSuspendAt) && (
          <span className={s.userLine}>
            {u.suspended && (
              <span className={s.tagSuspended} title={u.autoSuspended && u.suspendedAt ? COPY.autoSuspendedTitle(shortWhen(u.suspendedAt, now)) : undefined}>
                {COPY.suspendedTag}
              </span>
            )}
            {/* In the Suspended tag's place (never both), so the row keeps its size when it flips. */}
            {!u.suspended && u.autoSuspendAt && (
              <button type="button" className={s.tagAuto} disabled={locked} onClick={act('autoOff')}
                title={locked ? COPY.sharedTitle : COPY.autoTitle(shortWhen(u.autoSuspendAt, now))} aria-label={COPY.fAutoSuspend}>
                <IconClock size={11} />
                <span dir="rtl">{timeLeft(u.autoSuspendAt, now.getTime())}</span>
              </button>
            )}
            {u.shared && <span className={`${p.testTag} ${s.tagShared}`} title={COPY.sharedTitle}>{COPY.sharedTag}</span>}
            {sub && <span className={s.userSub} dir="ltr" title={sub}>{sub}</span>}
          </span>
        )}
      </td>
      <td className={s.cPhone} data-label={COPY.colPhone}><span className={s.ltr} dir="ltr">{u.phone || '—'}</span></td>
      {showAgent && <td className={s.cAgent} data-label={COPY.colAgent}><span className={s.clip} dir="auto" title={u.agentName}>{u.agentName}</span></td>}
      <td className={s.cNum} data-label={COPY.colConversations}>{u.conversations.toLocaleString('he-IL')}</td>
      <td className={s.cWhen} data-label={COPY.colCreated}>{shortWhen(u.createdAt, now)}</td>
      <td className={s.cWhen} data-label={COPY.colLastActive}>{shortWhen(u.lastActiveAt, now)}</td>
      <td className={s.cActions}>
        <span className={s.actions} title={locked ? COPY.sharedTitle : undefined}>
          <button type="button" className={s.act} disabled={locked} onClick={act(u.suspended ? 'reactivate' : 'suspend')}>
            {u.suspended ? <IconPlay size={13} /> : <IconPause size={13} />}
            {u.suspended ? COPY.actReactivate : COPY.actSuspend}
          </button>
          <button type="button" className={s.act} disabled={locked} onClick={act(u.audience === 'real' ? 'test' : 'real')}>
            {u.audience === 'real' ? COPY.actMakeTest : COPY.actMakeReal}
          </button>
          <button type="button" className={`${s.act} ${s.actDelete}`} disabled={locked} onClick={act('delete')}
            title={locked ? COPY.sharedTitle : COPY.actDelete} aria-label={COPY.actDelete}>
            <IconTrash size={14} />
          </button>
        </span>
      </td>
    </tr>
  );
}

function UsersTable({ users, now, showAgent, empty, onOpen, onAction }: {
  users: ManageUser[]; now: Date; showAgent: boolean; empty: string;
  onOpen: (u: ManageUser) => void; onAction: (u: ManageUser, a: Action) => void;
}) {
  return (
    <div className={p.tableWrap}>
      <table className={`${s.table} ${showAgent ? s.withAgent : ''}`}>
        <thead>
          <tr>
            <th className={s.cUser}>{COPY.colUser}</th>
            <th className={s.cPhone}>{COPY.colPhone}</th>
            {showAgent && <th className={s.cAgent}>{COPY.colAgent}</th>}
            <th className={s.cNum}>{COPY.colConversations}</th>
            <th className={s.cWhen}>{COPY.colCreated}</th>
            <th className={s.cWhen}>{COPY.colLastActive}</th>
            <th className={s.cActions}>{COPY.colActions}</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr className={s.emptyRow}><td colSpan={showAgent ? 7 : 6}>{empty}</td></tr>
          ) : users.map(u => (
            <UserRow key={rowKey(u)} u={u} now={now} showAgent={showAgent} onOpen={onOpen} onAction={onAction} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UsersPage({ scope, agentSlug, me }: ManagePageProps) {
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [users, setUsers] = useState<ManageUser[] | null>(null);
  const [showTest, setShowTest] = useState(false);
  const [openUser, setOpenUser] = useState<ManageUser | null>(null);
  const [openConv, setOpenConv] = useState<ManageUserConversation | null>(null);
  const [confirm, setConfirm] = useState<{ user: ManageUser; action: Action } | null>(null);
  const [adding, setAdding] = useState(false);
  // The rows' clock (#1002): the auto-suspend time left, and a row turns
  // suspended when its time passes with the page open. Every 30 s.
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const key = `${scope}|${agentSlug}|${tick}`;

  useEffect(() => {
    let alive = true;
    const load = scope === 'all' ? manageService.getAllUsers() : manageService.getAgentUsers(agentSlug || '');
    load
      .then(data => { if (alive) { setLoaded({ key, data }); setUsers(data.users); setNow(new Date()); } })
      .catch(error => { if (alive) setLoaded({ key, error }); });
    return () => { alive = false; };
    // `key` carries every input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = loaded && loaded.key === key ? loaded : null;
  const data = current?.data || loaded?.data;
  const loading = !current;
  const error = current?.error;

  const scopeName = scope === 'all' ? COPY.allAgents : (me.agents.find(a => a.slug === agentSlug)?.name || agentSlug || '');
  const rowsNow = clock > now ? clock : now;
  const list = (users || []).map(u => liveUser(u, rowsNow.getTime()));
  const real = list.filter(u => u.audience === 'real');
  const test = list.filter(u => u.audience === 'test');
  const showAgent = scope === 'all';

  /** The server's answer replaces the row (or removes it) — a real/test change moves it between the parts. */
  const runAction = async (u: ManageUser, a: Action) => {
    if (a === 'delete') {
      await manageService.deleteUser(u.agentSlug, u.id);
      setUsers(prev => (prev || []).filter(x => rowKey(x) !== rowKey(u)));
    } else {
      const r = a === 'autoOff'
        ? await manageService.clearAutoSuspend(u.agentSlug, u.id)
        : a === 'suspend' || a === 'reactivate'
          ? await manageService.setUserSuspended(u.agentSlug, u.id, a === 'suspend')
          : await manageService.setUserRealCustomer(u.agentSlug, u.id, a === 'real');
      setUsers(prev => (prev || []).map(x => (rowKey(x) === rowKey(u) && r.user ? r.user : x)));
    }
    setConfirm(null);
  };

  const confirmWords = (u: ManageUser, a: Action) => {
    const n = nameOf(u);
    switch (a) {
      case 'suspend': return { title: COPY.confirmSuspendTitle(n), body: COPY.confirmSuspendBody, label: COPY.actSuspend };
      case 'reactivate': return { title: COPY.confirmReactivateTitle(n), body: COPY.confirmReactivateBody, label: COPY.actReactivate };
      case 'real': return { title: COPY.confirmRealTitle(n), body: COPY.confirmRealBody, label: COPY.actMakeReal };
      case 'test': return { title: COPY.confirmTestTitle(n), body: COPY.confirmTestBody, label: COPY.actMakeTest };
      case 'autoOff': return {
        title: COPY.confirmAutoOffTitle(n),
        body: COPY.confirmAutoOffBody(u.autoSuspendAt ? shortWhen(u.autoSuspendAt, rowsNow) : '—'),
        label: COPY.actAutoOff,
      };
      default: return { title: COPY.confirmDeleteTitle(n), body: COPY.confirmDeleteBody(u.conversations), label: COPY.actDelete };
    }
  };

  return (
    <div className={s.page}>
      <header className={p.head}>
        <div className={p.titleBlock}>
          <h1 className={p.title}>{COPY.usersMenu}</h1>
          <span className={p.scopeName} dir="auto">{scopeName}</span>
        </div>
        <div className={p.controls}>
          <button type="button" className={s.addBtn} onClick={() => setAdding(true)}>+ {COPY.addUser}</button>
          <button type="button" className={p.refresh} onClick={() => setTick(n => n + 1)} title={COPY.refresh}>
            <IconRefresh size={14} className={loading ? p.spin : undefined} />
            <span>{COPY.updated} {data ? agoText(data.checkedAt, now) : '…'}</span>
          </button>
        </div>
      </header>

      {error && !data ? (
        <div className={p.message}>
          {error instanceof ManageApiError && (error.code === 'no_agent' || error.code === 'no_agent_access') ? COPY.noAgentAccess : COPY.loadFailed}
        </div>
      ) : !data ? (
        <div className={p.message}>{COPY.loading}</div>
      ) : (
        <div className={`${s.sections} ${loading ? p.stale : ''}`}>
          <section className={`${p.card} ${s.card}`}>
            <header className={p.cardHead}>
              <h2 className={p.cardTitle}>{COPY.realTitle} <span className={p.count}>({real.length})</span></h2>
            </header>
            <UsersTable users={real} now={rowsNow} showAgent={showAgent} empty={COPY.emptyReal}
              onOpen={setOpenUser} onAction={(user, action) => setConfirm({ user, action })} />
          </section>

          <section className={`${p.card} ${s.card} ${s.testCard}`}>
            <header className={`${p.cardHead} ${s.foldHead} ${showTest ? '' : s.foldHeadClosed}`}>
              <button type="button" className={s.fold} aria-expanded={showTest} onClick={() => setShowTest(v => !v)}>
                <span className={s.foldTitle}>
                  <IconChevronDown size={15} className={showTest ? s.foldOpen : s.foldClosed} />
                  <span className={p.cardTitle}>{COPY.testTitle} <span className={p.count}>({test.length})</span></span>
                  <span className={p.cardHint}>{COPY.testHint}</span>
                </span>
                <span className={s.foldAction}>{showTest ? COPY.hideTest : COPY.showTest}</span>
              </button>
            </header>
            {showTest && (
              <UsersTable users={test} now={rowsNow} showAgent={showAgent} empty={COPY.emptyTest}
                onOpen={setOpenUser} onAction={(user, action) => setConfirm({ user, action })} />
            )}
          </section>

          {data.truncated && <p className={s.note}>{COPY.usersTruncated(data.limit)}</p>}
        </div>
      )}

      {openUser && !openConv && (
        <UserModal user={openUser} now={now} onOpenConversation={setOpenConv} onClose={() => setOpenUser(null)} />
      )}
      {openUser && openConv && (
        <ConversationModal
          conversation={{
            agentSlug: openUser.agentSlug, agentName: openUser.agentName, conversationId: openConv.id,
            customerName: openUser.name, audience: openConv.audience,
          }}
          canInvestigate={me.all}
          now={now}
          onClose={() => setOpenConv(null)}
        />
      )}
      {adding && (
        <AddUserModal
          agentSlug={scope === 'all' ? null : (agentSlug || null)}
          me={me}
          onAdded={user => {
            // A new user is a test user (until marked real): open that part so the row is in view.
            setUsers(prev => [user, ...(prev || []).filter(x => rowKey(x) !== rowKey(user))]);
            if (user.audience === 'test') setShowTest(true);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}
      {confirm && (() => {
        const w = confirmWords(confirm.user, confirm.action);
        return (
          <ConfirmModal
            title={w.title}
            body={w.body}
            confirmLabel={w.label}
            danger={confirm.action === 'delete'}
            onConfirm={() => runAction(confirm.user, confirm.action)}
            onClose={() => setConfirm(null)}
            failText={err => (err instanceof ManageApiError && err.code === 'user_shared' ? COPY.actionShared
              : err instanceof ManageApiError && err.code === 'already_suspended' ? COPY.autoOffTooLate : COPY.actionFailed)}
          />
        );
      })()}
    </div>
  );
}
