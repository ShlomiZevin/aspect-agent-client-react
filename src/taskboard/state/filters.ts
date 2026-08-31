/**
 * Board filters as one value instead of fifteen useState calls.
 *
 * The old board kept `filterAssignee`, `filterOpener`, `filterPriority`,
 * `filterType`, `idSearch`, `titleSearch`, `showCompleted`,
 * `showUnassignedOnly`, `showDraftsOnly`, `myTasksMode`, `filterAttention` and
 * more as separate pieces of state in a 1550-line component. Clearing them meant
 * remembering all fifteen setters, and every one was a separate re-render.
 *
 * Here they are one object with one reducer, which also makes "is anything
 * filtered" and "reset" single expressions rather than long conjunctions.
 */
import type { Task, TaskPriority, TaskType } from '../types';

export interface Filters {
  /** One box for both id and title — a numeric query matches the id. */
  search: string;
  assignee: string | null;
  opener: string | null;
  priority: TaskPriority | null;
  type: TaskType | null;
  tag: string | null;
  showDone: boolean;
  unassignedOnly: boolean;
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
  showDone: false,
  unassignedOnly: false,
  draftsOnly: false,
  mine: false,
  needsAttention: false,
};

export type FilterAction =
  | { type: 'set'; patch: Partial<Filters> }
  | { type: 'toggle'; key: 'showDone' | 'unassignedOnly' | 'draftsOnly' | 'mine' | 'needsAttention' }
  | { type: 'reset' };

export function filtersReducer(state: Filters, action: FilterAction): Filters {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch };
    case 'toggle':
      return { ...state, [action.key]: !state[action.key] };
    case 'reset':
      return EMPTY_FILTERS;
  }
}

export function isFiltered(f: Filters): boolean {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[]).some(k => f[k] !== EMPTY_FILTERS[k]);
}

/** How many filters are active, for the badge on the filter button. */
export function activeCount(f: Filters): number {
  return (Object.keys(EMPTY_FILTERS) as (keyof Filters)[])
    .filter(k => f[k] !== EMPTY_FILTERS[k]).length;
}

const eq = (a: string | undefined, b: string | null) =>
  b === null || (a ?? '').toLowerCase() === b.toLowerCase();

/**
 * Whether a task survives the filters.
 *
 * `attentionIds` is passed in rather than read from a store because it comes
 * from the server and can still be loading; `null` means "not known yet", which
 * must not silently behave like "nothing needs attention".
 */
export function matches(
  task: Task,
  f: Filters,
  ctx: { me: string | null; attentionIds: Set<number> | null },
): boolean {
  if (!f.showDone && task.status === 'done') return false;
  // Drafts are their own view: on, you see only drafts; off, you see none.
  if (task.isDraft !== f.draftsOnly) return false;

  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    // A bare number means "task #n" — the id is how people refer to these in
    // conversation, and typing 412 to search titles almost never means anything.
    const byId = /^\d+$/.test(q) ? String(task.id) === q : false;
    if (!byId && !task.title.toLowerCase().includes(q)) return false;
  }

  if (!eq(task.assignee, f.assignee)) return false;
  if (!eq(task.opener, f.opener)) return false;
  if (f.priority && task.priority !== f.priority) return false;
  if (f.type && task.type !== f.type) return false;
  if (f.tag && !task.tags.includes(f.tag)) return false;
  if (f.unassignedOnly && task.assignee) return false;

  if (f.mine) {
    const me = (ctx.me ?? '').toLowerCase();
    const mine = (task.assignee ?? '').toLowerCase() === me
      || (task.opener ?? '').toLowerCase() === me;
    if (!me || !mine) return false;
  }

  // Unknown ids means the answer has not arrived; showing everything is the
  // honest state, and the caller renders a loading hint next to the toggle.
  if (f.needsAttention && ctx.attentionIds && !ctx.attentionIds.has(task.id)) return false;

  return true;
}
