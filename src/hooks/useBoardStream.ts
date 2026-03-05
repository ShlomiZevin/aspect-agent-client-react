import { useEffect, useRef } from 'react';
import type { Task, TaskComment } from '../types/task';
import { API_BASE } from '../services/notificationsService';

export type BoardEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_updated'; task: Task }
  | { type: 'comment_added'; taskId: number; comment: TaskComment };

export function useBoardStream(enabled: boolean, onEvent: (event: BoardEvent) => void): void {
  // Keep ref to latest callback so the effect never needs to re-subscribe
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource(`${API_BASE}/api/board/stream`);

    es.onmessage = (e) => {
      try {
        onEventRef.current(JSON.parse(e.data) as BoardEvent);
      } catch {
        // ignore malformed events
      }
    };

    return () => es.close();
  }, [enabled]);
}
