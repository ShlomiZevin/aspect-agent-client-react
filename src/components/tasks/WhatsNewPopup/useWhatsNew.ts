import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { WhatsNewItem } from '../../../types/task';
import * as taskService from '../../../services/taskService';
import { useBoardStream } from '../../../hooks/useBoardStream';

const IDENTITY_KEY = 'aspect_commenter_identity';

/** Away this long (tab hidden, or no pointer activity) counts as coming back. */
const AWAY_MS = 20 * 60 * 1000;

/** Safety net — board events live on one server instance, so a release can miss this tab's stream. */
const POLL_MS = 60 * 1000;

/** Fired by the task board's What's New button to open the popup on demand. */
export const OPEN_WHATS_NEW_EVENT = 'lybi:open-whats-new';

function readIdentity(): string | null {
  try {
    return localStorage.getItem(IDENTITY_KEY);
  } catch {
    return null;
  }
}

/**
 * What's New: tasks released since this person's "seen until" watermark.
 *
 * - Opens by itself on first load and when the person comes back after being away.
 * - A release that lands while they are working never opens it: it announces itself
 *   (`incoming` — the corner message) and then stays as a badge until "Got it".
 * - "Got it" moves the watermark to the newest item shown.
 *
 * `auto` = all of the above (Builder V2 pages). Without it the hook stays quiet and
 * only answers the task board's What's New button.
 */
export function useWhatsNew(auto: boolean) {
  const location = useLocation();
  const [identity, setIdentity] = useState<string | null>(readIdentity);
  const [items, setItems] = useState<WhatsNewItem[]>([]);
  const [incoming, setIncoming] = useState<WhatsNewItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const itemsRef = useRef<WhatsNewItem[]>([]);
  itemsRef.current = items;
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  // Ids this tab already knows about — null until the first successful load, so the
  // backlog found on page load opens the popup instead of being announced as "incoming".
  const knownIdsRef = useRef<Set<number> | null>(null);

  const refresh = useCallback(async (): Promise<WhatsNewItem[]> => {
    const id = readIdentity();
    setIdentity(id);
    if (!id) {
      setItems([]);
      setIncoming([]);
      return [];
    }
    try {
      const { tasks } = await taskService.getWhatsNew(id);
      const known = knownIdsRef.current;
      if (known) {
        const fresh = tasks.filter(t => !known.has(t.id));
        if (fresh.length > 0 && !isOpenRef.current) setIncoming(fresh);
      }
      knownIdsRef.current = new Set(tasks.map(t => t.id));
      setItems(tasks);
      return tasks;
    } catch {
      return itemsRef.current;
    }
  }, []);

  const openIfAny = useCallback(async () => {
    const list = await refresh();
    if (list.length > 0) {
      setIsOpen(true);
      setIncoming([]);
    }
  }, [refresh]);

  // Arriving on a builder page: open straight away if something was released since the last visit.
  useEffect(() => {
    if (auto) openIfAny();
  }, [auto, openIfAny]);

  // Moving to another page re-checks, so a release this tab's stream missed still shows.
  const isFirstLocationRef = useRef(true);
  useEffect(() => {
    if (isFirstLocationRef.current) {
      isFirstLocationRef.current = false;
      return;
    }
    if (auto) refresh();
  }, [auto, location.pathname, refresh]);

  // Coming back after being away (tab hidden, or idle) opens it again.
  useEffect(() => {
    if (!auto) return;
    let hiddenAt: number | null = document.hidden ? Date.now() : null;
    let lastActive = Date.now();

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const wasAway = hiddenAt !== null && Date.now() - hiddenAt >= AWAY_MS;
      hiddenAt = null;
      lastActive = Date.now();
      if (wasAway) openIfAny();
      else refresh();
    };

    // Pointer activity only: a keystroke must never pop a dialog over what is being typed.
    const onPointer = () => {
      const now = Date.now();
      if (now - lastActive >= AWAY_MS) openIfAny();
      lastActive = now;
    };
    const onKey = () => {
      lastActive = Date.now();
    };
    const onFocus = () => {
      refresh();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('mousemove', onPointer, { passive: true });
    window.addEventListener('wheel', onPointer, { passive: true });
    window.addEventListener('touchstart', onPointer, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('mousemove', onPointer);
      window.removeEventListener('wheel', onPointer);
      window.removeEventListener('touchstart', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [auto, openIfAny, refresh]);

  // Safety-net poll while the tab is visible. Never opens the popup.
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [auto, refresh]);

  // Live: a release shows up within seconds, without a page refresh.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useBoardStream(auto && !!identity, (event) => {
    if (event.type !== 'task_updated' || !event.task.deployedAt) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { refresh(); }, 1500);
  });
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // The task board's What's New button opens it on demand, even when there is nothing new.
  useEffect(() => {
    const onOpen = () => {
      refresh().then(() => {
        setIsOpen(true);
        setIncoming([]);
      });
    };
    window.addEventListener(OPEN_WHATS_NEW_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WHATS_NEW_EVENT, onOpen);
  }, [refresh]);

  const open = useCallback(() => {
    setIsOpen(true);
    setIncoming([]);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const dismissIncoming = useCallback(() => setIncoming([]), []);

  // Watermark = newest item shown, not "now": a release landing while the popup is open stays for next time.
  const gotIt = useCallback(async () => {
    const id = readIdentity();
    const shown = itemsRef.current;
    setIsOpen(false);
    setIncoming([]);
    if (!id || shown.length === 0) return;
    const newest = shown.reduce(
      (max, t) => (new Date(t.deployedAt).getTime() > new Date(max).getTime() ? t.deployedAt : max),
      shown[0].deployedAt
    );
    setItems([]);
    try {
      await taskService.markWhatsNewSeen(id, newest);
    } finally {
      refresh();
    }
  }, [refresh]);

  return { items, incoming, isOpen, open, close, gotIt, dismissIncoming };
}
