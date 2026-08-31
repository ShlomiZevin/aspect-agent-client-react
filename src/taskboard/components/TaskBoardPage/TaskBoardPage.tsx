import { useMemo, useReducer, useState } from 'react';
import { BoardView } from '../BoardView';
import { TaskDialog } from '../TaskDialog';
import { NewTaskModal } from '../NewTaskModal';
import { IdentityModal } from '../IdentityModal';
import { ListView } from '../ListView';
import { NotificationBell } from '../NotificationBell';
import { WhatsNewModal } from '../WhatsNewModal';
import { EMPTY_FILTERS, activeCount, filtersReducer, matches } from '../../state/filters';
import { useAttention, useBoard } from '../../state/useBoard';
import { useIdentity, usePeople } from '../../state/useIdentity';
import { useNotifications, useWhatsNew } from '../../state/useNotifications';
import { PRIORITIES, TYPES } from '../../types';
import type { Task, TaskPriority, TaskStatus, TaskType } from '../../types';
import styles from './TaskBoardPage.module.css';

/**
 * The Aspect task board.
 *
 * Deliberately thin: data lives in useBoard, filtering in state/filters, and the
 * two views render what they are given. The board this replaces put all of it in
 * one 1550-line component with 35 useState calls, which is why a filter change
 * re-rendered every card and why the form wiped itself mid-edit.
 *
 * English and LTR, like the board it replaces — this is an internal tool for
 * three people. It is NOT wired into i18n, and that is a decision rather than an
 * oversight: if it ever ships to a client's super-user, the strings move to
 * translations.ts in both locales at that point.
 */
export function TaskBoardPage() {
  const { tasks, loading, error, create, update, remove, deploy } = useBoard();
  const { me, identify } = useIdentity();
  const { people, add: addPerson } = usePeople();
  const { ids: attentionIds, refresh: refreshAttention } = useAttention(me);
  const notifications = useNotifications(me);
  const whatsNew = useWhatsNew(me);

  const [filters, dispatch] = useReducer(filtersReducer, EMPTY_FILTERS);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [askingName, setAskingName] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  // Remembered per browser: whoever prefers the table gets it back next time
  // rather than re-selecting it on every visit.
  const [view, setView] = useState<'board' | 'list'>(() => {
    try {
      return localStorage.getItem('aspect_taskboard_view') === 'list' ? 'list' : 'board';
    } catch {
      return 'board';
    }
  });

  const changeView = (next: 'board' | 'list') => {
    setView(next);
    try { localStorage.setItem('aspect_taskboard_view', next); } catch { /* private mode */ }
  };

  const visible = useMemo(() => {
    const list = [...tasks.values()].filter(t => matches(t, filters, { me, attentionIds }));
    // Newest first within a column; the board's own order is by status.
    return list.sort((a, b) => b.id - a.id);
  }, [tasks, filters, me, attentionIds]);

  // Read from the live map, not captured at open time, so an edit or someone
  // else's change is reflected while the dialog is open.
  const open = openId === null ? null : tasks.get(openId) ?? null;


  const moveTask = (id: number, status: TaskStatus) => {
    void update(id, { status }).then(refreshAttention);
  };

  return (
    <div className={styles.page} dir="ltr">
      <header className={styles.head}>
        <span className={styles.brand}>Aspect Tasks</span>
        <span className={styles.sub}>{visible.length} shown · {tasks.size} total</span>

        <span className={styles.spacer} />

        {me && whatsNew.tasks.length > 0 && (
          <button type="button" className={styles.whatsNew} onClick={() => setShowWhatsNew(true)}>
            What&apos;s new
            <span className={styles.whatsNewCount}>{whatsNew.tasks.length}</span>
          </button>
        )}

        {me && (
          <NotificationBell
            items={notifications.items}
            onOpenTask={setOpenId}
            onMarkRead={notifications.markRead}
          />
        )}

        <button
          type="button"
          className={styles.identity}
          onClick={() => setAskingName(true)}
          title="Change who you are"
        >
          {me ?? 'Who are you?'}
        </button>

        <button type="button" className={styles.primary} onClick={() => setCreating(true)}>
          New task
        </button>
      </header>

      <div className={styles.controls}>
        <input
          className={styles.search}
          placeholder="Search title, or type an id"
          value={filters.search}
          onChange={e => dispatch({ type: 'set', patch: { search: e.target.value } })}
        />

        <select
          className={styles.select}
          value={filters.assignee ?? ''}
          onChange={e => dispatch({ type: 'set', patch: { assignee: e.target.value || null } })}
        >
          <option value="">Anyone</option>
          {people.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>

        <select
          className={styles.select}
          value={filters.priority ?? ''}
          onChange={e => dispatch({ type: 'set', patch: { priority: (e.target.value || null) as TaskPriority | null } })}
        >
          <option value="">Any priority</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          className={styles.select}
          value={filters.type ?? ''}
          onChange={e => dispatch({ type: 'set', patch: { type: (e.target.value || null) as TaskType | null } })}
        >
          <option value="">Any type</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <Toggle on={filters.mine} onClick={() => dispatch({ type: 'toggle', key: 'mine' })} disabled={!me}>
          Mine
        </Toggle>
        <Toggle on={filters.needsAttention} onClick={() => dispatch({ type: 'toggle', key: 'needsAttention' })} disabled={!me}>
          Waiting on me
        </Toggle>
        <Toggle on={filters.unassignedOnly} onClick={() => dispatch({ type: 'toggle', key: 'unassignedOnly' })}>
          Unassigned
        </Toggle>
        <Toggle on={filters.showDone} onClick={() => dispatch({ type: 'toggle', key: 'showDone' })}>
          Show done
        </Toggle>
        <Toggle on={filters.draftsOnly} onClick={() => dispatch({ type: 'toggle', key: 'draftsOnly' })}>
          Drafts
        </Toggle>

        <span className={styles.spacer} />

        <div className={styles.viewSwitch} role="group" aria-label="View">
          <button
            type="button"
            className={`${styles.viewBtn} ${view === 'board' ? styles.viewBtnOn : ''}`}
            aria-pressed={view === 'board'}
            onClick={() => changeView('board')}
          >
            Board
          </button>
          <button
            type="button"
            className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnOn : ''}`}
            aria-pressed={view === 'list'}
            onClick={() => changeView('list')}
          >
            List
          </button>
        </div>

        {activeCount(filters) > 0 && (
          <button type="button" className={styles.toggle} onClick={() => dispatch({ type: 'reset' })}>
            Clear ({activeCount(filters)})
          </button>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <main className={styles.main}>
        {loading && tasks.size === 0
          ? <p className={styles.state}>Loading…</p>
          : view === 'board' ? (
            <BoardView
              tasks={visible}
              attentionIds={attentionIds}
              onOpen={(t: Task) => setOpenId(t.id)}
              onMove={moveTask}
            />
          ) : (
            <ListView
              tasks={visible}
              attentionIds={attentionIds}
              onOpen={(t: Task) => setOpenId(t.id)}
            />
          )}
      </main>

      {creating && (
        <NewTaskModal
          me={me}
          people={people}
          onCancel={() => setCreating(false)}
          onCreate={async draft => {
            const task = await create(draft);
            setCreating(false);
            // Straight into the new task: creating one is almost always the
            // first half of writing it up.
            setOpenId(task.id);
          }}
        />
      )}

      {showWhatsNew && (
        <WhatsNewModal
          tasks={whatsNew.tasks}
          loading={whatsNew.loading}
          onClose={() => setShowWhatsNew(false)}
          onOpenTask={setOpenId}
          onDismiss={whatsNew.dismiss}
          onDismissAll={whatsNew.dismissAll}
        />
      )}

      {askingName && (
        <IdentityModal
          people={people}
          onCancel={() => setAskingName(false)}
          onPick={name => { identify(name); setAskingName(false); }}
          onAddPerson={addPerson}
        />
      )}

      {open && (
        <TaskDialog
          task={open}
          me={me}
          people={people}
          allTasks={[...tasks.values()]}
          onClose={() => { setOpenId(null); void refreshAttention(); }}
          onSave={update}
          onDelete={remove}
          onDeploy={deploy}
        />
      )}
    </div>
  );
}

function Toggle({ on, onClick, disabled, children }: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${styles.toggle} ${on ? styles.toggleOn : ''}`}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
