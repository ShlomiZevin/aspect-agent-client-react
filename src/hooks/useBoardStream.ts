import { useEffect, useRef } from 'react';
import type { Task, TaskComment } from '../types/task';
import type { AgendaComment } from '../services/agendaCommentsService';
import { API_BASE } from '../services/notificationsService';

export type BoardEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'comment_added'; taskId: number; comment: TaskComment }
  // Comments on agenda lines (action items) — services/agendaComments.service.js
  | { type: 'agenda_comment'; action: 'added' | 'edited'; taskId: number; comment: AgendaComment }
  | { type: 'agenda_comment'; action: 'deleted'; taskId: number; id: number };

const RECONNECT_DELAY_MS = 3_000;

export function useBoardStream(enabled: boolean, onEvent: (event: BoardEvent) => void): void {
  // Keep ref to latest callback so the effect never needs to re-subscribe
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`${API_BASE}/api/board/stream`);

      es.onmessage = (e) => {
        try {
          onEventRef.current(JSON.parse(e.data) as BoardEvent);
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es?.close();
        es = null;
        if (!stopped) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [enabled]);
}
