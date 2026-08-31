import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { TaskColumns } from '../TaskColumns';
import { TaskFormModal } from '../TaskFormModal';
import { IdentityModal } from '../IdentityModal';
import { ListView } from '../ListView';
import { NotificationBell } from '../NotificationBell';
import { WhatsNewModal } from '../WhatsNewModal';
import { EMPTY_FILTERS, activeCount, filtersReducer, matches } from '../../state/filters';
import { useAttention, useBoard } from '../../state/useBoard';
import { useIdentity, usePeople } from '../../state/useIdentity';
import { useNotifications, useWhatsNew } from '../../state/useNotifications';
import { LABELS, PRIORITIES, TYPES } from '../../types';
import type { Task, TaskPriority, TaskStatus, TaskType } from '../../types';
import styles from './TaskBoardPage.module.css';

/**
 * The Aspect task board.
 *
 * Header, toolbar, columns, list and cards are the original board's markup and
 * stylesheet, so the two look the same. What differs is underneath: data in
 * useBoard with optimistic writes over a live stream, filters as one reducer
 * rather than fifteen pieces of state, and the page in a fraction of the
 * original's 1550 lines.
 *
 * English and LTR, as the original is — an internal tool for three people, so
 * deliberately not wired into i18n.
 */
export function TaskBoardPage() {
  const { tasks, loading, error, reload, create, update, remove, deploy } = useBoard();
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
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [idSearch, setIdSearch] = useState('');
  const [exportMode, setExportMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

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

  const visible = useMemo(
    () => [...tasks.values()]
      .filter(t => matches(t, filters, { me, attentionIds }))
      .sort((a, b) => b.id - a.id),
    [tasks, filters, me, attentionIds],
  );

  // Read from the live map rather than captured at open time, so an edit or
  // someone else's change shows while the dialog is open.
  const open = openId === null ? null : tasks.get(openId) ?? null;

  const moveTask = (id: number, status: TaskStatus) => {
    void update(id, { status }).then(refreshAttention);
  };

  // Everyone who has opened a task, for the By Creator filter. Derived rather
  // than fetched: the openers ARE whoever appears on the board.
  const openers = useMemo(() => {
    const names = new Set<string>();
    for (const t of tasks.values()) if (t.opener) names.add(t.opener);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const draftCount = useMemo(
    () => [...tasks.values()].filter(t => t.isDraft).length,
    [tasks],
  );

  const toggleSelected = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /** Copies the chosen tasks as markdown, in the original's shape. */
  const copySelected = async () => {
    const chosen = visible.filter(t => selected.has(t.id));
    if (chosen.length === 0) return;

    const lines: string[] = ['## Tasks', ''];
    chosen.forEach((task, i) => {
      lines.push(`### ${i + 1}. [#${task.id}] ${task.title}`);
      if (task.description) {
        const div = document.createElement('div');
        div.innerHTML = task.description;
        lines.push(div.textContent || '');
      }
      lines.push('');
    });

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; failing quietly beats an alert.
    }
  };

  /** Promotes the chosen drafts to real tasks. */
  const fireDrafts = async () => {
    const ids = [...selected];
    setSelected(new Set());
    await Promise.all(ids.map(id => update(id, { isDraft: false }).catch(() => { /* resynced */ })));
  };

  // Ctrl+Shift+L toggles the drafts view, as in the original.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        dispatch({ type: 'toggle', key: 'draftsOnly' });
        setSelected(new Set());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={styles.modal} dir="ltr">
      <div className={styles.header}>
        <h2 className={styles.title}>
          Task Board
          <button
            className={`${styles.refreshBtn} ${refreshing ? styles.refreshSpin : ''}`}
            onClick={async () => { setRefreshing(true); await reload(); setRefreshing(false); }}
            disabled={refreshing}
            title="Refresh tasks"
          >
            &#8635;
          </button>
        </h2>

        <div className={styles.headerRight}>
          {me && (
            <button
              className={`${styles.whatsNewBtn} ${whatsNew.tasks.length > 0 ? styles.whatsNewActive : ''}`}
              onClick={() => setShowWhatsNew(true)}
              title="Recently deployed features"
            >
              What&apos;s New{whatsNew.tasks.length > 0 ? ` (${whatsNew.tasks.length})` : ''}
            </button>
          )}

          {me && (
            <NotificationBell
              items={notifications.items}
              onOpenTask={setOpenId}
              onMarkRead={notifications.markRead}
            />
          )}

          <button className={styles.whatsNewBtn} onClick={() => setAskingName(true)} title="Change who you are">
            {me ?? 'Who are you?'}
          </button>
        </div>
      </div>

      <div className={styles.toolbarRow1}>
        <button className={styles.addBtn} onClick={() => setCreating(true)}>+ Add Task</button>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === 'list' && !filters.mine ? styles.active : ''}`}
            onClick={() => { changeView('list'); dispatch({ type: 'set', patch: { mine: false } }); }}
          >
            List
          </button>
          <button
            className={`${styles.viewBtn} ${view === 'board' ? styles.active : ''}`}
            onClick={() => { changeView('board'); dispatch({ type: 'set', patch: { mine: false } }); }}
          >
            Board
          </button>
          <button
            className={`${styles.viewBtn} ${filters.mine ? styles.active : ''}`}
            onClick={() => { changeView('list'); dispatch({ type: 'toggle', key: 'mine' }); }}
            disabled={!me}
          >
            My Tasks
          </button>
        </div>

        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <input
            className={`${styles.titleSearch} ${filters.search.trim() ? styles.titleSearchActive : ''}`}
            type="text"
            placeholder="Search..."
            value={filters.search}
            onChange={e => dispatch({ type: 'set', patch: { search: e.target.value } })}
          />
          {filters.search.trim() && (
            <button
              className={styles.titleSearchClear}
              onClick={() => dispatch({ type: 'set', patch: { search: '' } })}
              title="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <input
          className={styles.idSearch}
          type="text"
          placeholder="#ID"
          value={idSearch}
          onChange={e => setIdSearch(e.target.value)}
          // Enter jumps to the task rather than filtering to it: an id is an
          // exact address, and opening it is what anyone typing one wants.
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            const id = parseInt(idSearch.replace('#', ''), 10);
            if (Number.isFinite(id) && tasks.has(id)) { setOpenId(id); setIdSearch(''); }
          }}
        />

        <button className={styles.filtersToggleBtn} onClick={() => setShowFilters(v => !v)}>
          {showFilters ? 'Filters ▴' : 'Filters ▾'}
          {activeCount(filters) > 0 ? ` (${activeCount(filters)})` : ''}
        </button>
      </div>

      <div className={`${styles.toolbarRow2} ${showFilters ? styles.toolbarRow2Visible : styles.toolbarRow2Hidden}`}>
        <select
          className={styles.domainFilter}
          value={filters.assignee ?? ''}
          onChange={e => dispatch({ type: 'set', patch: { assignee: e.target.value || null } })}
        >
          <option value="">All assignees</option>
          {people.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>

        <select
          className={styles.crewFilter}
          value={filters.priority ?? ''}
          onChange={e => dispatch({ type: 'set', patch: { priority: (e.target.value || null) as TaskPriority | null } })}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{LABELS[p] ?? p}</option>)}
        </select>

        <select
          className={styles.crewFilter}
          value={filters.type ?? ''}
          onChange={e => dispatch({ type: 'set', patch: { type: (e.target.value || null) as TaskType | null } })}
        >
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{LABELS[t] ?? t}</option>)}
        </select>

        <select
          className={styles.crewFilter}
          value={filters.opener ?? ''}
          onChange={e => dispatch({ type: 'set', patch: { opener: e.target.value || null } })}
        >
          <option value="">By Creator</option>
          {openers.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        {view === 'list' && !filters.draftsOnly && (
          <button
            className={`${styles.selectToggleBtn} ${exportMode ? styles.selectActive : ''}`}
            onClick={() => { setExportMode(m => !m); setSelected(new Set()); }}
          >
            {exportMode ? '✓ Select' : 'Select'}
          </button>
        )}

        <button
          className={`${styles.selectToggleBtn} ${filters.needsAttention ? styles.selectActive : ''}`}
          disabled={!me}
          onClick={() => dispatch({ type: 'toggle', key: 'needsAttention' })}
          title="Tasks where someone spoke after you last did and you have not replied"
        >
          {filters.needsAttention && attentionIds
            ? `🔔 Attention (${attentionIds.size})`
            : '🔔 Needs my attention'}
        </button>

        <div className={styles.toggleGroup}>
          <Toggle on={filters.draftsOnly} onClick={() => { dispatch({ type: 'toggle', key: 'draftsOnly' }); setSelected(new Set()); }}>
            Drafts{draftCount > 0 ? ` (${draftCount})` : ''}
          </Toggle>
          <Toggle on={filters.showCompleted} onClick={() => dispatch({ type: 'toggle', key: 'showCompleted' })}>
            Completed
          </Toggle>
          <Toggle on={filters.limbo} onClick={() => dispatch({ type: 'toggle', key: 'limbo' })}>
            💀 Limbo
          </Toggle>
          <Toggle on={filters.unassignedOnly} onClick={() => dispatch({ type: 'toggle', key: 'unassignedOnly' })}>
            Unassigned
          </Toggle>
        </div>

        {activeCount(filters) > 0 && (
          <button className={styles.clearFiltersBtn} onClick={() => dispatch({ type: 'reset' })}>
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk promote, in the drafts view */}
      {filters.draftsOnly && visible.length > 0 && (
        <div className={styles.bulkActions}>
          <div className={styles.bulkInfo}>
            <label className={styles.selectAllLabel}>
              <input
                type="checkbox"
                checked={selected.size === visible.length && visible.length > 0}
                onChange={e => setSelected(e.target.checked ? new Set(visible.map(t => t.id)) : new Set())}
              />
              Select All ({visible.length})
            </label>
            {selected.size > 0 && <span className={styles.selectedCount}>{selected.size} selected</span>}
          </div>
          {selected.size > 0 && (
            <button className={styles.fireBtn} onClick={fireDrafts}>
              🔥 Fire {selected.size} Draft{selected.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}

      {/* Copy for Claude Code, in Select mode */}
      {view === 'list' && exportMode && selected.size > 0 && (
        <div className={styles.exportActions}>
          <span className={styles.exportSelectedCount}>{selected.size} selected</span>
          <button className={styles.exportBtn} onClick={copySelected}>
            {copied ? 'Copied!' : `Copy ${selected.size} for Claude Code`}
          </button>
        </div>
      )}

      {error && <div className={styles.errorBar}>{error}</div>}

      <div className={styles.content}>
        <div className={styles.boardArea}>
          {loading && tasks.size === 0 ? (
            <div className={styles.loading}>Loading...</div>
          ) : view === 'board' ? (
            <TaskColumns
              tasks={visible}
              allTasks={[...tasks.values()]}
              onTaskClick={(t: Task) => setOpenId(t.id)}
              onStatusChange={moveTask}
              onAtRiskToggle={(id, atRisk) => { void update(id, { atRisk }); }}
              onMarkComplete={(id, acknowledged) => { void update(id, { acknowledged }); }}
            />
          ) : (
            <ListView
              tasks={visible}
              onTaskClick={(t: Task) => setOpenId(t.id)}
              onDeleteTask={(t: Task) => { void remove(t.id); }}
              selectMode={filters.draftsOnly ? 'draft' : exportMode ? 'export' : null}
              selected={selected}
              onToggleSelect={toggleSelected}
              onToggleSelectAll={all => setSelected(all ? new Set(visible.map(t => t.id)) : new Set())}
            />
          )}
        </div>
      </div>

      {creating && (
        <TaskFormModal
          me={me}
          people={people}
          allTasks={[...tasks.values()]}
          onCancel={() => setCreating(false)}
          onChangeIdentity={() => setAskingName(true)}
          // Closes and leaves you on the board, as the original does. Opening
          // the new task straight away meant every creation ended in a dialog
          // nobody asked for.
          onSubmit={async draft => { await create(draft); setCreating(false); }}
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
        <TaskFormModal
          task={open}
          me={me}
          people={people}
          allTasks={[...tasks.values()]}
          onCancel={() => { setOpenId(null); void refreshAttention(); }}
          onChangeIdentity={() => setAskingName(true)}
          onSubmit={async draft => {
            await update(open.id, draft);
            setOpenId(null);
            void refreshAttention();
          }}
          onDelete={async id => { await remove(id); setOpenId(null); }}
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
      className={`${styles.filterToggleBtn} ${on ? styles.filterToggleActive : ''}`}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
