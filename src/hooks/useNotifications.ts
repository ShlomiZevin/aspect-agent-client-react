import { useState, useEffect, useCallback, useRef } from 'react';
import * as notificationsService from '../services/notificationsService';
import type { TaskNotification } from '../services/notificationsService';

const IDENTITY_STORAGE_KEY = 'aspect_commenter_identity';
const POLL_INTERVAL_MS = 10_000;

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const doPlay = () => {
      const play = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
        if (start > 0) osc.onended = () => ctx.close();
      };
      play(1047, 0, 0.18);   // C6
      play(880, 0.15, 0.25); // A5
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(doPlay).catch(() => {});
    } else {
      doPlay();
    }
  } catch { /* audio not available */ }
}

export interface UseNotificationsReturn {
  notifications: TaskNotification[];
  /** Count of notifications that arrived as undelivered (NEW) and not yet cleared */
  newCount: number;
  identity: string | null;
  /** Set identity, persist to localStorage, and immediately fetch notifications */
  setIdentity: (name: string) => void;
  /** Call when user opens the notification panel — marks delivered on server and zeroes badge */
  clearNew: () => Promise<void>;
}

export function useNotifications(enabled: boolean): UseNotificationsReturn {
  const [identity, setIdentityState] = useState<string | null>(
    () => localStorage.getItem(IDENTITY_STORAGE_KEY)
  );
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  // Track which IDs were undelivered when last fetched, so sound only plays once per new batch
  const prevUndeliveredRef = useRef<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async (currentIdentity: string) => {
    try {
      const data = await notificationsService.getNotifications(currentIdentity);
      const undeliveredIds = new Set(data.filter(n => !n.isDelivered).map(n => n.id));

      // Play sound only for IDs that are newly undelivered (not seen before)
      const genuinelyNew = [...undeliveredIds].filter(id => !prevUndeliveredRef.current.has(id));
      if (genuinelyNew.length > 0) {
        playNotificationSound();
      }
      prevUndeliveredRef.current = undeliveredIds;

      setNotifications(data);
    } catch {
      // silent — board still usable
    }
  }, []);

  useEffect(() => {
    // Stop polling when disabled
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setNotifications([]);
      prevUndeliveredRef.current = new Set();
      return;
    }

    const current = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (current !== identity) setIdentityState(current);
    if (!current) return;

    // Immediate fetch on open
    fetchNotifications(current);

    // Poll every 10s while board is open
    intervalRef.current = setInterval(() => {
      const id = localStorage.getItem(IDENTITY_STORAGE_KEY);
      if (id) fetchNotifications(id);
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, identity]);

  const clearNew = useCallback(async () => {
    const id = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!id) return;
    // Mark as delivered on server, then update local state
    try {
      await notificationsService.markDelivered(id);
      setNotifications(prev => prev.map(n => ({ ...n, isDelivered: true })));
      prevUndeliveredRef.current = new Set();
    } catch {
      // silent
    }
  }, []);

  const setIdentity = useCallback((name: string) => {
    localStorage.setItem(IDENTITY_STORAGE_KEY, name);
    setIdentityState(name);
    // Immediate fetch for the new identity
    fetchNotifications(name);
  }, [fetchNotifications]);

  return {
    notifications,
    newCount: notifications.filter(n => !n.isDelivered).length,
    identity,
    setIdentity,
    clearNew,
  };
}
