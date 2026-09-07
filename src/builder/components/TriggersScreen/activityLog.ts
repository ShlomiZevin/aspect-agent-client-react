/**
 * activityLog — the shared feed the Triggers screen writes to.
 *
 * Two kinds of thing end up in one list, and they come from different
 * places on purpose:
 *
 *   REAL RUNS come from the server. Every fire opens a `trigger_events`
 *   row before the crew starts and closes it after, so the panel can
 *   show "running now" and does not need to be told anything — it polls
 *   the conversation and sees the truth, including runs the CLOCK
 *   started while nobody was pressing buttons. It also survives a
 *   refresh, because it was never client state to begin with.
 *
 *   ASKS ("will it trigger?") come from here. They are read-only by
 *   definition, so there is no server row to find — inventing one would
 *   mean writing a record for something that did not happen. They live
 *   in this session and are gone on reload, which is the honest
 *   lifetime for "what did I just press".
 *
 * ── Structured, not sentences ──────────────────────────────────────
 *
 * An entry carries a LIST of per-trigger results, not one joined
 * string. The first version logged prose — "Silence: due now — the
 * clock will run it on its next check (quiet for 3 minutes)" — and six
 * of those stacked up read as a wall: you could not see at a glance
 * which had run and which had not, because the only difference was
 * buried mid-sentence. A name, a state and a reason as three separate
 * fields can be scanned down a column; a paragraph cannot.
 *
 * A context rather than props because the two writers are far apart in
 * the tree (the clock strip and a modal footer) and neither should have
 * to be handed a logger through three components that do not care. The
 * default is a no-op, so ClockBar keeps working on the admin tab where
 * there is no panel at all.
 *
 * The provider lives in its own file so this one exports no components
 * — mixing the two breaks Fast Refresh for everything that imports it.
 */

import { createContext, useContext } from 'react';

/**
 * Every state a trigger can be reported in, from either source.
 *
 * Shared by asks and by server events so the same situation always
 * looks the same, whoever reported it.
 */
export type TriggerState =
  | 'due'        // would go off right now
  | 'notDue'     // conditions not met yet
  | 'skipped'    // off, or no crew — never considered
  | 'sent'       // chain ran and produced a message
  | 'noMessage'  // chain ran and decided to say nothing
  | 'held'       // quiet hours
  | 'blocked'    // failed the author's conditions
  | 'failed'
  | 'running';

export interface TriggerLine {
  trigger: string;
  state: TriggerState;
  /** The arithmetic — "quiet 4 hours, needs 2 days". */
  detail?: string;
}

export interface AskEntry {
  id: string;
  at: string;
  /** Which button was pressed. */
  action: 'ask' | 'run';
  /** One trigger's name, shown when `scopeAll` is not set. */
  scope: string;
  /**
   * True when the press covered every trigger on the agent.
   *
   * A flag rather than checking `scope === 'all triggers'`: the two are
   * drawn differently, and deciding that from a display string means a
   * trigger somebody names "all triggers" would be drawn as the wrong
   * thing.
   */
  scopeAll?: boolean;
  lines: TriggerLine[];
  /** Something true of the whole attempt, e.g. the master switch is off. */
  note?: string;
  /**
   * The request is still in flight.
   *
   * Set the instant the button is pressed — a real run takes a second
   * or two to open its event row, and an empty panel in that gap reads
   * as "nothing happened". Cleared when the request returns; the entry
   * itself STAYS, as the record of what you pressed.
   */
  pending?: boolean;
}

export interface ActivityApi {
  asks: AskEntry[];
  /** Record what a button press asked and what came back. */
  logAsk: (e: Omit<AskEntry, 'id' | 'at'>) => void;
  /** Record a press immediately, before the server answers; returns its id. */
  logPending: (e: Omit<AskEntry, 'id' | 'at'>) => string;
  /** The request returned — stop the spinner, optionally add what it said. */
  markResolved: (id: string, patch?: Partial<AskEntry>) => void;
  /** Drop an entry outright (the request never reached the server). */
  dropPending: (id: string) => void;
  /** Something that writes just happened — re-read the server feed. */
  bumpRuns: () => void;
  /** Incremented by `bumpRuns`; the panel refetches when it changes. */
  runsNonce: number;
}

export const NOOP_ACTIVITY: ActivityApi = {
  asks: [],
  logAsk: () => {},
  logPending: () => '',
  markResolved: () => {},
  dropPending: () => {},
  bumpRuns: () => {},
  runsNonce: 0,
};

export const ActivityCtx = createContext<ActivityApi>(NOOP_ACTIVITY);

export function useActivityLog(): ActivityApi {
  return useContext(ActivityCtx);
}

/** Server outcome → the shared state. */
export function stateOfOutcome(outcome: string | null | undefined, status?: string): TriggerState {
  if (status === 'running') return 'running';
  switch (outcome) {
    case 'spoke':       return 'sent';
    case 'silent':      return 'noMessage';
    case 'filtered':    return 'blocked';
    case 'quiet_hours': return 'held';
    case 'error':       return 'failed';
    case 'would_run':   return 'due';
    case 'not_due':     return 'notDue';
    case 'skipped':     return 'skipped';
    default:            return 'noMessage';
  }
}
