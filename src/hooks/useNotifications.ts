import { useState, useEffect, useCallback, useRef } from 'react';
import * as notificationsService from '../services/notificationsService';
import type { TaskNotification } from '../services/notificationsService';

const IDENTITY_STORAGE_KEY = 'aspect_commenter_identity';
const POLL_INTERVAL_MS = 30_000;

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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async (currentIdentity: string | null) => {
    if (!currentIdentity) return;
    try {
      const data = await notificationsService.getNotifications(currentIdentity);
      setNotifications(data);
    } catch {
      // silent — network errors shouldn't break the UI
    }
  }, []);

  // Re-check identity from localStorage on each poll (in case user sets it via CommentsSection)
  const refresh = useCallback(async () => {
    const current = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (current !== identity) setIdentity(current);
    await fetchNotifications(current);
  }, [identity, fetchNotifications]);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Fetch immediately on enable
    refresh();

    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, refresh]);

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
