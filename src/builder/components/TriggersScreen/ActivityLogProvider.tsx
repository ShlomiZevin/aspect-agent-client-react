/**
 * ActivityLogProvider — holds the session's "asks" and the refetch
 * signal for real runs. See `activityLog.ts` for what goes where and
 * why runs are not kept here.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityCtx, type AskEntry } from './activityLog';

let seq = 0;

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const [asks, setAsks] = useState<AskEntry[]>([]);
  const [runsNonce, setRunsNonce] = useState(0);

  const logAsk = useCallback((e: Omit<AskEntry, 'id' | 'at'>) => {
    seq += 1;
    const entry: AskEntry = { ...e, id: `ask_${seq}`, at: new Date().toISOString() };
    // Capped: this is "what did I just do", not a log file. Twenty is
    // more than anyone scrolls back through in one sitting.
    setAsks(prev => [entry, ...prev].slice(0, 20));
  }, []);

  const logPending = useCallback((e: Omit<AskEntry, 'id' | 'at'>) => {
    seq += 1;
    const id = `pending_${seq}`;
    setAsks(prev => [{ ...e, id, at: new Date().toISOString(), pending: true }, ...prev].slice(0, 20));
    return id;
  }, []);

  // The entry STAYS — it is the record of what you pressed, and the
  // outcomes arrive separately as their own rows. Only the spinner
  // stops, plus whatever the response had to add.
  const markResolved = useCallback((id: string, patch?: Partial<AskEntry>) => {
    setAsks(prev => prev.map(a => (a.id === id ? { ...a, ...patch, pending: false } : a)));
  }, []);

  const dropPending = useCallback((id: string) => {
    setAsks(prev => prev.filter(a => a.id !== id));
  }, []);

  const bumpRuns = useCallback(() => setRunsNonce(n => n + 1), []);

  const value = useMemo(
    () => ({ asks, logAsk, logPending, markResolved, dropPending, bumpRuns, runsNonce }),
    [asks, logAsk, logPending, markResolved, dropPending, bumpRuns, runsNonce],
  );

  return <ActivityCtx.Provider value={value}>{children}</ActivityCtx.Provider>;
}
