import { useState, useEffect, useCallback, useRef } from 'react';
import * as notificationsService from '../services/notificationsService';
import type { TaskNotification } from '../services/notificationsService';

const IDENTITY_STORAGE_KEY = 'aspect_commenter_identity';

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
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
  } catch { /* audio not available */ }
}

export interface UseNotificationsReturn {
  notifications: TaskNotification[];
  unreadCount: number;
  identity: string | null;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(enabled: boolean): UseNotificationsReturn {
  const [identity, setIdentity] = useState<string | null>(
    () => localStorage.getItem(IDENTITY_STORAGE_KEY)
  );
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    const current = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (current !== identity) setIdentity(current);
    if (!current) return;
    try {
      const data = await notificationsService.getNotifications(current);
      setNotifications(data);
    } catch {
      // silent
    }
  }, [identity]);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      esRef.current?.close();
      esRef.current = null;
      return;
    }

    const current = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (current !== identity) setIdentity(current);

    if (!current) return;

    // Fetch existing unread notifications immediately
    notificationsService.getNotifications(current)
      .then(data => setNotifications(data))
      .catch(() => {});

    // Open SSE stream for real-time updates
    const es = new EventSource(
      `${notificationsService.API_BASE}/api/notifications/stream?identity=${encodeURIComponent(current)}`
    );
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const notification: TaskNotification = JSON.parse(event.data);
        setNotifications(prev => [notification, ...prev]);
        playNotificationSound();
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      // Browser will auto-reconnect; nothing to do
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, identity]);

  const markRead = useCallback(async (id: number) => {
    await notificationsService.markRead(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!identity) return;
    await notificationsService.markAllRead(identity);
    setNotifications([]);
  }, [identity]);

  return {
    notifications,
    unreadCount: notifications.length,
    identity,
    markRead,
    markAllRead,
    refresh,
  };
}
