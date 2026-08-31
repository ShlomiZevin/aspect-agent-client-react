/**
 * Board filters as one value instead of fifteen useState calls.
 *
 * The original keeps `filterAssignee`, `filterOpener`, `filterPriority`,
 * `filterType`, `titleSearch`, `showCompleted`, `showUnassignedOnly`,
 * `showDraftsOnly`, `showLimbo`, `myTasksMode`, `filterAttention` and more as
 * separate pieces of state inside a 1550-line component. Clearing them means
 * remembering every setter, and each one is its own re-render.
 *
 * The predicate below follows the original's order and meaning exactly — see
 * matches().
 */
import type { Task, TaskPriority, TaskType } from '../types';

export interface Filters {
  /** Title search. The id search is a jump, not a filter — see the toolbar. */
  search: string;
  assignee: string | null;
  opener: string | null;
  priority: TaskPriority | null;
  type: TaskType | null;
  tag: string | null;
  /**
   * Show tasks a PM has signed off (`acknowledged`). Off by default, as in the
   * original — and NOT the same thing as hiding status='done', which the
   * original never does. Conflating the two emptied the Done column.
   */
  showCompleted: boolean;
  /** Off hides Limbo entirely; on shows ONLY Limbo. Not a normal include. */
  limbo: boolean;
  unassignedOnly: boolean;
  /** Exclusive view: only drafts, nothing else. */
  draftsOnly: boolean;
  /** Assigned to me or opened by me. */
  mine: boolean;
  /** Restricted to the ids the server says are waiting on me. */
  needsAttention: boolean;
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  assignee: null,
  opener: null,
  priority: null,
  type: null,
  tag: null,
  showCompleted: false,
  limbo: false,
  unassignedOnly: false,
  draftsOnly: false,
  mine: false,
  needsAttention: false,
};

export type ToggleKey = 'showCompleted' | 'limbo' | 'unassignedOnly' | 'draftsOnly' | 'mine' | 'needsAttention';

export type FilterAction =
  | { type: 'set'; patch: Partial<Filters> }
  | { type: 'toggle'; key: ToggleKey }
  | { type: 'reset' };

export function filtersReducer(state: Filters, action: FilterAction): Filters {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch };
    case 'toggle': {
      const next = { ...state, [action.key]: !state[action.key] };
      // Turning the drafts view on clears the filters that cannot apply to it,
      // as the original does — a drafts list filtered by assignee is empty and
      // looks broken.
      if (action.key === 'draftsOnly' && next.draftsOnly) {
        next.unassignedOnly = false;
        next.assignee = null;
      }
      return next;
    }
    case 'reset':
      return EMPTY_FILTERS;
  }
}

export function isFiltered(f: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).some(k => f[k] !== EMPTY_FILTERS[k]);
}

/** How many filters are active, for the badge on the Filters button. */
export function activeCount(f: Filters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[])
    .filter(k => f[k] !== EMPTY_FILTERS[k]).length;
}

const eq = (a: string | undefined, b: string | null) =>
  b === null || (a ?? '').toLowerCase() === b.toLowerCase();

/**
 * Whether a task survives the filters, in the original's order.
 *
 * Note what is NOT here: status. The board never hides done tasks — the Done
 * column is a column, not a filter.
 *
 * `attentionIds` is passed in rather than read from a store because it comes
 * from the server and can still be loading; `null` means "not known yet", which
 * must not quietly behave like "nothing needs attention".
 */
export function matches(
  task: Task,
  f: Filters,
  ctx: { me: string | null; attentionIds: Set<number> | null },
): boolean {
  // The drafts view is exclusive and ignores everything below it.
  if (f.draftsOnly) return task.isDraft;
  // Drafts are hidden everywhere else.
  if (task.isDraft) return false;

  if (!f.showCompleted && task.acknowledged) return false;

  // Limbo is a parking space, not a person: hidden unless asked for, and then
  // shown alone.
  if (f.limbo ? task.assignee !== 'Limbo' : task.assignee === 'Limbo') return false;

  if (f.unassignedOnly) {
    if (task.assignee) return false;
  } else if (!eq(task.assignee, f.assignee)) {
    return false;
  }

  if (!eq(task.opener, f.opener)) return false;
  if (f.priority && task.priority !== f.priority) return false;
  if (f.type && task.type !== f.type) return false;
  if (f.tag && !task.tags.includes(f.tag)) return false;

  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    if (!task.title.toLowerCase().includes(q)) return false;
  }

  if (f.mine) {
    const me = (ctx.me ?? '').toLowerCase();
    const mine = (task.assignee ?? '').toLowerCase() === me
      || (task.opener ?? '').toLowerCase() === me;
    if (!me || !mine) return false;
  }

  // Unknown ids means the answer has not arrived; showing everything is the
  // honest state, and the toolbar renders a loading hint beside the toggle.
  if (f.needsAttention && ctx.attentionIds && !ctx.attentionIds.has(task.id)) return false;

  return true;
}
