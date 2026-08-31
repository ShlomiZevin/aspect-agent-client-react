import { useCallback, useEffect, useReducer, useState } from 'react';
import { api } from '../api';
import type { BoardEvent, Task, TaskDraft } from '../types';

/**
 * The board's tasks: one fetch, then live updates, with writes applied locally
 * before the server answers.
 *
 * The old board re-fetched every task after every mutation, which is why editing
 * a card made the whole list flash. Here a mutation patches the local list and
 * the reply reconciles it, so the only full load is the first one.
 *
 * Tasks are held in a Map keyed by id rather than an array. Every operation the
 * UI performs is "replace the task with this id", which is O(n) on an array and
 * has to be written correctly each time; the SSE stream makes that happen
 * several times a second when someone else is working.
 */

type State = {
  byId: Map<number, Task>;
  loading: boolean;
  error: string | null;
};

type Action =
  | { type: 'loaded'; tasks: Task[] }
  | { type: 'failed'; error: string }
  | { type: 'upsert'; task: Task }
  | { type: 'patch'; id: number; patch: TaskDraft }
  | { type: 'remove'; id: number }
  | { type: 'reloading' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reloading':
      return { ...state, loading: true, error: null };
    case 'loaded':
      return { byId: new Map(action.tasks.map(t => [t.id, t])), loading: false, error: null };
    case 'failed':
      return { ...state, loading: false, error: action.error };
    case 'upsert': {
      const byId = new Map(state.byId);
      byId.set(action.task.id, action.task);
      return { ...state, byId };
    }
    case 'patch': {
      const current = state.byId.get(action.id);
      if (!current) return state;
      const byId = new Map(state.byId);
      byId.set(action.id, { ...current, ...action.patch } as Task);
      return { ...state, byId };
    }
    case 'remove': {
      if (!state.byId.has(action.id)) return state;
      const byId = new Map(state.byId);
      byId.delete(action.id);
      return { ...state, byId };
    }
  }
}

const RECONNECT_MS = 3_000;

export function useBoard() {
  const [state, dispatch] = useReducer(reducer, {
    byId: new Map<number, Task>(),
    loading: true,
    error: null,
  });

  const reload = useCallback(async () => {
    dispatch({ type: 'reloading' });
    try {
      dispatch({ type: 'loaded', tasks: await api.listTasks() });
    } catch (err) {
      dispatch({ type: 'failed', error: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // --- live updates ---------------------------------------------------------
  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      source = new EventSource(api.streamUrl());

      source.onmessage = e => {
        let event: BoardEvent;
        try {
          event = JSON.parse(e.data);
        } catch {
          return; // a malformed frame is not worth tearing the stream down for
        }
        switch (event.type) {
          case 'task_created':
          case 'task_updated':
            dispatch({ type: 'upsert', task: event.task });
            break;
          case 'task_deleted':
            dispatch({ type: 'remove', id: event.taskId });
            break;
          // Comment events are for whoever has that task open; the list itself
          // shows nothing that changes when a comment arrives.
          default:
            break;
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (!stopped) retry = setTimeout(connect, RECONNECT_MS);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  // --- writes ---------------------------------------------------------------

  const create = useCallback(async (draft: TaskDraft) => {
    const task = await api.createTask(draft);
    dispatch({ type: 'upsert', task });
    return task;
  }, []);

  /**
   * Puts the row back the way the SERVER has it.
   *
   * Used to undo an optimistic change that the server rejected. It refetches
   * rather than restoring a copy the hook was holding, for two reasons: a
   * remembered copy can itself be stale by the time the failure arrives, and
   * keeping one would mean reading state during render — which breaks
   * concurrent rendering and is what the first version of this did.
   */
  const resync = useCallback(async (id: number) => {
    try {
      dispatch({ type: 'upsert', task: await api.getTask(id) });
    } catch {
      // A 404 here means the task really is gone, so dropping it is correct.
      dispatch({ type: 'remove', id });
    }
  }, []);

  /**
   * Applies the patch locally, then sends it, so a drag lands immediately
   * instead of after a round trip. A rejected change is resynced from the
   * server rather than left showing a column it never accepted.
   */
  const update = useCallback(async (id: number, patch: TaskDraft) => {
    dispatch({ type: 'patch', id, patch });
    try {
      const task = await api.updateTask(id, patch);
      dispatch({ type: 'upsert', task });
      return task;
    } catch (err) {
      await resync(id);
      throw err;
    }
  }, [resync]);

  const remove = useCallback(async (id: number) => {
    dispatch({ type: 'remove', id });
    try {
      await api.deleteTask(id);
    } catch (err) {
      await resync(id);
      throw err;
    }
  }, [resync]);

  const deploy = useCallback(async (id: number) => {
    const task = await api.markDeployed(id);
    dispatch({ type: 'upsert', task });
    return task;
  }, []);

  return {
    tasks: state.byId,
    loading: state.loading,
    error: state.error,
    reload,
    create,
    update,
    remove,
    deploy,
  };
}

/** Ids the server says are waiting on this person, refreshed on demand. */
export function useAttention(me: string | null) {
  const [ids, setIds] = useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!me) { setIds(null); return; }
    setLoading(true);
    try {
      setIds(new Set(await api.needsAttention(me)));
    } catch {
      // A failed badge count is not worth an error banner; leaving it unknown
      // makes the filter show everything rather than wrongly showing nothing.
      setIds(null);
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { ids, loading, refresh };
}
