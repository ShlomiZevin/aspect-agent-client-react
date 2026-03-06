import { useState, useEffect, useCallback, useRef } from 'react';
import * as notificationsService from '../services/notificationsService';
import type { TaskNotification } from '../services/notificationsService';

const IDENTITY_STORAGE_KEY = 'aspect_commenter_identity';
const POLL_INTERVAL_MS = 10_000;

function lastClearedKey(identity: string): string {
  return `aspect_notif_cleared_${identity}`;
}

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
  /** Count of notifications newer than the last time this browser cleared the badge */
  newCount: number;
  identity: string | null;
  /** Set identity, persist to localStorage, and immediately fetch notifications */
  setIdentity: (name: string) => void;
  /** Call when user opens the notification panel — zeroes badge for this browser only */
  clearNew: () => void;
}

export function useNotifications(enabled: boolean): UseNotificationsReturn {
  const [identity, setIdentityState] = useState<string | null>(
    () => localStorage.getItem(IDENTITY_STORAGE_KEY)
  );
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [newCount, setNewCount] = useState(0);
  // Track which IDs were already seen this session so sound plays only once per new batch
  const prevSeenIdsRef = useRef<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const computeNewCount = useCallback((data: TaskNotification[], id: string): number => {
    const clearedStr = localStorage.getItem(lastClearedKey(id));
    const cutoff = clearedStr ? new Date(clearedStr).getTime() : 0;
    return data.filter(n => new Date(n.createdAt).getTime() > cutoff).length;
  }, []);

  const fetchNotifications = useCallback(async (currentIdentity: string) => {
    try {
      const data = await notificationsService.getNotifications(currentIdentity);

      // Play sound only for IDs not seen before AND newer than last cleared timestamp
      const clearedStr = localStorage.getItem(lastClearedKey(currentIdentity));
      const cutoff = clearedStr ? new Date(clearedStr).getTime() : 0;
      const genuinelyNew = data.filter(
        n => !prevSeenIdsRef.current.has(n.id) && new Date(n.createdAt).getTime() > cutoff
      );
      if (genuinelyNew.length > 0) {
        playNotificationSound();
      }
      prevSeenIdsRef.current = new Set(data.map(n => n.id));

      setNotifications(data);
      setNewCount(computeNewCount(data, currentIdentity));
    } catch {
      // silent — board still usable
    }
  }, [computeNewCount]);

  useEffect(() => {
    // Stop polling when disabled
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setNotifications([]);
      setNewCount(0);
      prevSeenIdsRef.current = new Set();
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

  const clearNew = useCallback(() => {
    const id = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!id) return;
    // Save cleared timestamp per-browser — other browsers are unaffected
    localStorage.setItem(lastClearedKey(id), new Date().toISOString());
    setNewCount(0);
    // Also mark delivered on server so undelivered list stays clean
    notificationsService.markDelivered(id).catch(() => {});
  }, []);

  const setIdentity = useCallback((name: string) => {
    localStorage.setItem(IDENTITY_STORAGE_KEY, name);
    setIdentityState(name);
    // Immediate fetch for the new identity
    fetchNotifications(name);
  }, [fetchNotifications]);

  return {
    notifications,
    newCount,
    identity,
    setIdentity,
    clearNew,
  };
}
