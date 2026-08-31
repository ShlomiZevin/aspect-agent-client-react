import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Person } from '../types';

/**
 * Who is using the board.
 *
 * A name typed once and kept in localStorage, with no account behind it — the
 * same trust model the board has always had, and the thing that changes when the
 * Google-auth work lands. It is written down here so there is one file to
 * replace rather than a `localStorage.getItem` scattered through the UI.
 *
 * The key is deliberately shared with the old board (`aspect_commenter_identity`)
 * so nobody has to introduce themselves twice.
 */
const KEY = 'aspect_commenter_identity';

export function useIdentity() {
  const [me, setMe] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      // Private mode, or storage disabled. The board still works; it just asks
      // who you are every time.
      return null;
    }
  });

  const identify = useCallback((name: string) => {
    const clean = name.trim();
    if (!clean) return;
    try { localStorage.setItem(KEY, clean); } catch { /* not fatal */ }
    setMe(clean);
  }, []);

  return { me, identify };
}

/** The roster, plus a way to add to it. */
export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);

  // The fetch lives inside the effect rather than in a callback the effect
  // calls: React's lint rule reads the callback as a synchronous setState in an
  // effect body, and inlining it also gives somewhere to hang the cancelled
  // flag, so an unmount during the request cannot set state on a dead hook.
  useEffect(() => {
    let cancelled = false;
    api.listPeople()
      .then(list => { if (!cancelled) setPeople(list); })
      .catch(() => {
        // An empty roster degrades the assignee picker to a free-text field,
        // which is poor but better than a board that will not render.
        if (!cancelled) setPeople([]);
      });
    return () => { cancelled = true; };
  }, []);

  const reload = useCallback(async () => {
    try {
      setPeople(await api.listPeople());
    } catch {
      setPeople([]);
    }
  }, []);

  const add = useCallback(async (name: string) => {
    const person = await api.addPerson(name);
    await reload();
    return person;
  }, [reload]);

  return { people, add, reload };
}
