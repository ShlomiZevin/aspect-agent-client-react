import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Notification, Task } from '../types';

const POLL_MS = 30_000;

/**
 * The bell: unread notifications for one person.
 *
 * Polled rather than pushed. The board's SSE stream carries task and comment
 * events, but a notification is per-recipient and the stream is a broadcast —
 * routing them would mean the server knowing who each connection belongs to,
 * which it cannot until there are accounts. Thirty seconds is chosen against
 * that: the old board polled every ten, which for a three-person board is
 * three times the requests for no noticeable difference.
 */
export function useNotifications(me: string | null) {
  const [items, setItems] = useState<Notification[]>([]);

  // The poll lives inside the effect, with the cancelled flag it needs, rather
  // than in a callback the effect calls: React's lint rule reads the latter as
  // a synchronous setState in an effect body.
  useEffect(() => {
    if (!me) return;

    let cancelled = false;
    const tick = () => {
      api.notifications(me)
        .then(list => { if (!cancelled) setItems(list); })
        .catch(() => {
          // The bell is an accessory. A failed poll leaves the last known
          // count rather than flashing an error over the board.
        });
    };

    tick();
    const timer = setInterval(tick, POLL_MS);

    // Catching up on focus is what makes the 30s interval feel instant: coming
    // back to the tab is exactly when anyone looks at the bell.
    window.addEventListener('focus', tick);

    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', tick);
    };
  }, [me]);

  const load = useCallback(async (person: string) => {
    try {
      setItems(await api.notifications(person));
    } catch { /* see above */ }
  }, []);

  const markRead = useCallback(async (ids?: number[]) => {
    if (!me) return;
    // Dropped locally first: the bell must empty the moment it is opened, not a
    // round trip later.
    setItems(prev => (ids ? prev.filter(n => !ids.includes(n.id)) : []));
    try {
      await api.markNotificationsRead(me, ids);
    } catch {
      void load(me); // put back whatever really is still unread
    }
  }, [me, load]);

  return { items, markRead };
}

/**
 * Deployed tasks this person has not dismissed.
 *
 * Loaded once per identity rather than polled: a deploy is not something that
 * happens while you watch, and the list is re-read after each dismissal anyway.
 */
export function useWhatsNew(me: string | null) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    api.whatsNew(me)
      .then(list => { if (!cancelled) setTasks(list); })
      .catch(() => { if (!cancelled) setTasks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [me]);

  const refresh = useCallback(async () => {
    if (!me) { setTasks([]); return; }
    try {
      setTasks(await api.whatsNew(me));
    } catch {
      setTasks([]);
    }
  }, [me]);

  const dismiss = useCallback(async (id: number) => {
    if (!me) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    try {
      await api.dismiss(id, me);
    } catch {
      void refresh();
    }
  }, [me, refresh]);

  const dismissAll = useCallback(async () => {
    if (!me) return;
    const ids = tasks.map(t => t.id);
    setTasks([]);
    // Sequential on purpose: this is a handful of rows, and firing them all at
    // once against one Cloud Run instance buys nothing.
    for (const id of ids) {
      await api.dismiss(id, me).catch(() => { /* refreshed below */ });
    }
    void refresh();
  }, [me, tasks, refresh]);

  return { tasks, loading, refresh, dismiss, dismissAll };
}
