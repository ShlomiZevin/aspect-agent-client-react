import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanResponse } from '../../../types/replenishment';

/** What the engine says about where it is. Mirrors the server's `onProgress`. */
type Phase = 'reading' | 'read' | 'computing' | 'done';

/**
 * How long the panel takes to play through its four steps.
 *
 * The computation is far faster than a person can read: nine thousand items
 * rebuild in about four hundred milliseconds, so the panel used to appear and
 * vanish before the first step could be seen. This paces the DISPLAY so the
 * steps are legible.
 */
const PLAYBACK_MS = 2800;

export interface RecalcState {
  running: boolean;
  /** 0-100. See `displayed` below - never ahead of the work. */
  pct: number;
  phase: Phase | null;
  /** Rows the engine is working through, once the query has returned. */
  total: number;
  /**
   * True once a recalculation has finished cleanly; false again the moment the
   * next one starts.
   *
   * A FLAG, not a sentence. This used to hold the finished banner text, which
   * meant the message froze in whatever language it was composed in — recalc in
   * English, switch to Hebrew, and the banner stayed English under a Hebrew
   * page. Text belongs to the render, so the caller keeps the parameters and
   * words them every time it draws.
   */
  finished: boolean;
  error: string | null;
}

const IDLE: RecalcState = {
  running: false, pct: 0, phase: null, total: 0, finished: false, error: null,
};

/**
 * Recalculating the order plan, with progress that is paced but never invented.
 *
 * The rule this hook exists to enforce is one line of arithmetic:
 *
 *     displayed = min(real, playback)
 *
 * `real` is rows processed out of rows read, reported by the engine loop over
 * SSE. `playback` is a clock running over PLAYBACK_MS. Taking the MINIMUM means
 * the bar can be slowed down so a person can read it, and can never be sped up
 * past what the engine has actually done. If the work finishes in 400ms the
 * panel still plays out legibly; if a bigger dataset takes six seconds the
 * clock is irrelevant and the display follows the work, step for step.
 *
 * That asymmetry is the whole point. A progress bar that runs ahead of its work
 * is a lie, and this one cannot: every frame it draws has already happened.
 */
export function useRecalcStream(datasetId: string, baseURL?: string, lang?: string) {
  const [state, setState] = useState<RecalcState>(IDLE);
  const sourceRef = useRef<EventSource | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  const stop = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    clearTick();
  }, [clearTick]);

  useEffect(() => stop, [stop]);

  /** @returns the fresh recommendations, or null if it failed. */
  const recalculate = useCallback(() => {
    stop();
    setState({ ...IDLE, running: true });

    return new Promise<PlanResponse | null>((resolve) => {
      const startedAt = Date.now();
      // Held in refs, not state: the ticker reads them 15 times a second and
      // re-rendering on each SSE event as well would be twice the work for the
      // same frame.
      let real = 0;
      let result: PlanResponse | null = null;
      let settled = false;

      const finish = (value: PlanResponse | null, error: string | null) => {
        if (settled) return;
        settled = true;
        stop();
        setState(error
          ? { ...IDLE, error }
          : { running: false, pct: 100, phase: 'done', total: 0, finished: true, error: null });
        resolve(value);
      };

      tickRef.current = setInterval(() => {
        const playback = ((Date.now() - startedAt) / PLAYBACK_MS) * 100;
        const shown = Math.min(real, playback);
        setState(s => (s.running ? { ...s, pct: Math.min(100, Math.round(shown)) } : s));
        // Done only when BOTH are done: the work has landed and the panel has
        // been on screen long enough to read.
        if (result && shown >= 100) finish(result, null);
      }, 60);

      const qs = lang ? `?lang=${encodeURIComponent(lang)}` : '';
      const url = `${baseURL ?? ''}/api/modules/replenishment/${encodeURIComponent(datasetId)}/plan/stream${qs}`;
      const es = new EventSource(url);
      sourceRef.current = es;

      es.addEventListener('progress', (e) => {
        const p = JSON.parse((e as MessageEvent).data) as { phase: Phase; done: number; total: number };
        // Before the query returns there is nothing to be a fraction of, so
        // the bar stays where it is rather than guessing.
        if (p.total > 0) real = Math.min(100, (p.done / p.total) * 100);
        setState(s => (s.running ? { ...s, phase: p.phase, total: p.total || s.total } : s));
      });

      es.addEventListener('result', (e) => {
        result = JSON.parse((e as MessageEvent).data) as PlanResponse;
        real = 100;
        // Not finished yet - the ticker closes it once the playback catches up.
        // Unless it already has, on a machine slow enough that 2.8s has passed.
        if (Date.now() - startedAt >= PLAYBACK_MS) finish(result, null);
      });

      es.addEventListener('failed', (e) => {
        const { error } = JSON.parse((e as MessageEvent).data) as { error: string };
        finish(null, error);
      });

      // A dropped connection must not leave the panel spinning forever. The
      // save itself already succeeded by this point, so the page keeps its
      // saved value and only the recalculated view is missing.
      es.onerror = () => { if (!result) finish(null, 'connection-lost'); };
    });
  }, [datasetId, baseURL, lang, stop]);

  const dismissDone = useCallback(() => {
    setState(s => (s.finished ? { ...s, finished: false } : s));
  }, []);

  return { ...state, recalculate, dismissDone, stop };
}
