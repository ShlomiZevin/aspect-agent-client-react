/**
 * Investigation jobs, lifted out of InvestigateHero so they render as
 * persistent header badges (see JobBadges.tsx) rather than an inline strip —
 * a job survives navigating between Insights/detail since it lives here, at
 * the shell level, not inside whichever page happened to start it.
 *
 * Jobs are also persisted to sessionStorage: a page reload kills the
 * in-memory promise chain that was awaiting the server, but the server
 * itself keeps running the investigation regardless (it's a plain async
 * request handler, not tied to the client staying connected) and still
 * persists the resulting insight. So on reload, a job that was 'running' is
 * resumed by polling the insights list for a new id rather than being lost.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { insightsService } from '../../../services/insightsService';
import type { InvestigateResult } from '../../../types/insights';

export type JobStatus = 'running' | 'completed' | 'error';

export interface Job {
  id: string;
  datasetId: string;
  /** The anon session that started this job — reports are private per user, see insightsService. */
  userId: string;
  prompt: string;
  status: JobStatus;
  progress: number;
  startedAt: number;
  /** Real server-reported pipeline stage (plan|query|aggregate|synthesize|verify),
   * polled while the investigate request is still open — see stageProgress below. */
  stage?: string;
  /** Short server-supplied line about what this stage is actually doing, e.g. the data question PLAN settled on. */
  stageDetail?: string;
  /** Server-measured elapsed time for this run — used instead of reading a clock during render. */
  elapsedMs?: number;
  /** Server-computed time remaining, derived from the same stage model as `progress` so the two agree. */
  etaMs?: number;
  result?: InvestigateResult;
  errorMessage?: string;
  /** Insight ids that existed when this job started — the signal used to
   * spot the newly-created one if we have to resume-by-polling after a
   * reload wiped the original in-memory promise. */
  beforeIds?: string[];
}

interface JobsContextValue {
  jobs: Job[];
  selectedJobId: string | null;
  selectJob: (id: string | null) => void;
  startJob: (datasetId: string, userId: string, prompt: string) => string;
  cancelJob: (id: string) => void;
  restartJob: (datasetId: string, id: string) => void;
}

const JobsContext = createContext<JobsContextValue | undefined>(undefined);

/**
 * How often to ask the server which pipeline stage a running investigation is
 * actually in. Replaces the old FAKE_DURATION_MS = 8000 timer, which animated
 * the bar against a guessed 8-second runtime while a real investigation takes
 * 30-100s — so it raced to its 96% cap in under 8s, froze there for the rest
 * of the run, then snapped to 100%. The five named steps were driven off that
 * same fake number, so the UI claimed "Double-check the findings" was done
 * before the SQL had even run.
 */
const PROGRESS_POLL_MS = 1500;
/** Fallback pacing when the server has no progress for this job (older instance, or a job started before a restart). */
const FALLBACK_DURATION_MS = 60000;
const STORAGE_KEY = 'aspect-intel-jobs';
const RESUME_POLL_MS = 3000;
const RESUME_MAX_ATTEMPTS = 40; // ~2 minutes of polling after a reload

function loadStoredJobs(): Job[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// datasetId::prompt -> in flight. A plain ref, not React state: the dedup
// check in startJob must be synchronous and immediate, because two clicks
// close enough together (a real double-click, or two calls in the same
// event-loop tick) both run before React re-renders — checking the `jobs`
// state array alone lets both reads see the same stale "nothing running yet"
// snapshot and both pass. A ref mutates instantly, so the second call always
// sees what the first one just wrote, no matter how close together they are.
function jobKey(datasetId: string, prompt: string): string {
  return `${datasetId}::${prompt.trim()}`;
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(loadStoredJobs);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const runningKeys = useRef<Set<string>>(null as unknown as Set<string>);
  if (!runningKeys.current) {
    runningKeys.current = new Set(
      jobs.filter(j => j.status === 'running' && j.prompt.trim()).map(j => jobKey(j.datasetId, j.prompt)),
    );
  }
  const timers = useRef<Map<string, ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>>>(new Map());
  // Separate from `timers` (which holds the resume poll's setTimeout) — the
  // progress-bar ticker keeps running independently while polling, capped
  // at 96%, so a resumed job doesn't sit visibly frozen at whatever % it
  // happened to be at when the page reloaded.
  const progressTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const runJob = useCallback((datasetId: string, userId: string, id: string, prompt: string) => {
    const startedAt = Date.now();

    // The job id doubles as the server-side progress key, so the browser can
    // ask what the pipeline is REALLY doing while the investigate POST is
    // still open. Progress is clamped monotonic: a poll that arrives out of
    // order, or a fallback estimate, can never walk the bar backwards.
    const interval = setInterval(() => {
      insightsService
        .getProgress(datasetId, id)
        .then(p => {
          if (!p || p.done) return;
          setJobs(js => js.map(j => (
            j.id === id && j.status === 'running'
              ? { ...j, progress: Math.max(j.progress, p.percent), stage: p.stage, stageDetail: p.detail ?? j.stageDetail, elapsedMs: p.elapsedMs, etaMs: p.etaMs }
              : j
          )));
        })
        .catch(() => {
          // No server-side progress for this job (older revision, or the
          // instance restarted mid-run). Creep forward on a realistic
          // 60s scale instead of the old 8s one, still capped below 100.
          setJobs(js => js.map(j => {
            if (j.id !== id || j.status !== 'running') return j;
            const est = Math.round(100 * (1 - Math.exp(-(Date.now() - startedAt) / FALLBACK_DURATION_MS)));
            return { ...j, progress: Math.max(j.progress, Math.min(95, est)) };
          }));
        });
    }, PROGRESS_POLL_MS);
    timers.current.set(id, interval);

    insightsService.investigate(datasetId, userId, prompt, id)
      .then(result => {
        clearInterval(interval);
        timers.current.delete(id);
        if (prompt.trim()) runningKeys.current.delete(jobKey(datasetId, prompt));
        // Completion is now driven by the request actually resolving, not by
        // waiting out a fixed timer — the old code deliberately delayed the
        // result until FAKE_DURATION_MS had elapsed, which only ever made a
        // fast run feel slower and a slow run look stuck.
        setJobs(js => js.map(j => j.id === id ? { ...j, status: 'completed', progress: 100, stage: 'done', result, prompt: result.prompt || j.prompt } : j));
      })
      .catch(err => {
        clearInterval(interval);
        timers.current.delete(id);
        if (prompt.trim()) runningKeys.current.delete(jobKey(datasetId, prompt));
        setJobs(js => js.map(j => j.id === id ? { ...j, status: 'error', errorMessage: err.message } : j));
      });
  }, []);

  // Reconnects to a job whose original in-memory promise is gone (page was
  // reloaded while it was running). The POST that started it already ran to
  // completion server-side regardless — this just waits for the resulting
  // insight to show up by diffing against the snapshot taken at start time.
  const stopProgressTicker = (id: string) => {
    const t = progressTimers.current.get(id);
    if (t) { clearInterval(t); progressTimers.current.delete(id); }
  };

  const resumeJob = useCallback((datasetId: string, userId: string, id: string, prompt: string, beforeIds: string[] | undefined, attempt = 0) => {
    if (!beforeIds) {
      setJobs(js => js.map(j => j.id === id ? { ...j, status: 'error', errorMessage: 'Lost track of this investigation after a page reload — check the insights list below, or Restart to run a new one.' } : j));
      return;
    }
    // Keep the progress bar climbing (capped at 96%) while we poll — started
    // once, on the first attempt, not re-created on every poll tick.
    if (attempt === 0 && !progressTimers.current.has(id)) {
      const tickStart = Date.now();
      const tick = setInterval(() => {
        setJobs(js => js.map(j => {
          if (j.id !== id || j.status !== 'running') return j;
          // Resumed-after-reload path: the original request's promise is gone,
          // so there's nothing to poll against — ease forward on the realistic
          // 60s scale rather than the old 8s one, never regressing.
          const est = Math.round(100 * (1 - Math.exp(-(Date.now() - tickStart) / FALLBACK_DURATION_MS)));
          return { ...j, progress: Math.min(96, Math.max(j.progress, est)) };
        }));
      }, 150);
      progressTimers.current.set(id, tick);
    }

    insightsService.getInsights(datasetId, userId)
      .then(list => {
        const fresh = list.find(i => !beforeIds.includes(i.id));
        if (fresh) {
          stopProgressTicker(id);
          if (prompt.trim()) runningKeys.current.delete(jobKey(datasetId, prompt));
          const result: InvestigateResult = {
            prompt: fresh.headline,
            status: 'ready',
            resultLabel: fresh.headline,
            findingsCount: 1,
            combinedImpactLabel: fresh.impactValue,
            insightIds: [fresh.id],
          };
          setJobs(js => js.map(j => j.id === id ? { ...j, status: 'completed', progress: 100, result, prompt: fresh.headline } : j));
          return;
        }
        if (attempt >= RESUME_MAX_ATTEMPTS) {
          stopProgressTicker(id);
          if (prompt.trim()) runningKeys.current.delete(jobKey(datasetId, prompt));
          setJobs(js => js.map(j => j.id === id ? { ...j, status: 'error', errorMessage: 'This investigation is taking longer than expected to reappear after reload — check the insights list below, or Restart.' } : j));
          return;
        }
        const t = setTimeout(() => resumeJob(datasetId, userId, id, prompt, beforeIds, attempt + 1), RESUME_POLL_MS);
        timers.current.set(id, t);
      })
      .catch(() => {
        if (attempt >= RESUME_MAX_ATTEMPTS) {
          stopProgressTicker(id);
          if (prompt.trim()) runningKeys.current.delete(jobKey(datasetId, prompt));
          setJobs(js => js.map(j => j.id === id ? { ...j, status: 'error', errorMessage: 'Lost track of this investigation.' } : j));
          return;
        }
        const t = setTimeout(() => resumeJob(datasetId, userId, id, prompt, beforeIds, attempt + 1), RESUME_POLL_MS);
        timers.current.set(id, t);
      });
  }, []);

  // Runs once on mount: any job restored from sessionStorage that was still
  // 'running' when the page went away needs to be reconnected.
  useEffect(() => {
    jobs.forEach(j => {
      if (j.status === 'running') resumeJob(j.datasetId, j.userId, j.id, j.prompt, j.beforeIds);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startJob = useCallback((datasetId: string, userId: string, prompt: string) => {
    // A double-click / double-Enter on the same quick-question chip (or
    // clicking it again while it's still running) used to fire a second,
    // fully independent investigation — same question, two concurrent LLM/DB
    // runs, two separate report records once both finished. Reusing the
    // already-running job for an identical (trimmed) prompt on this dataset
    // makes a repeat click a no-op instead. Empty prompts (auto-proposed,
    // Aspect picks its own angle) are intentionally exempt — each one is a
    // genuinely distinct request, not a repeat of "the same question".
    //
    // Checked against `runningKeys` (a ref), not the `jobs` state array:
    // two calls close enough together (a fast double-click) both run before
    // React re-renders, so a state-based check has both reads see the same
    // stale snapshot and both pass. The ref is updated synchronously, so the
    // second call always sees what the first one just wrote.
    const normalized = prompt.trim();
    const key = normalized ? jobKey(datasetId, normalized) : null;
    if (key) {
      if (runningKeys.current.has(key)) {
        const already = jobs.find(j => j.datasetId === datasetId && j.status === 'running' && j.prompt.trim() === normalized);
        return already?.id ?? '';
      }
      runningKeys.current.add(key);
    }

    const id = crypto.randomUUID();
    setJobs(js => [...js, { id, datasetId, userId, prompt, status: 'running', progress: 0, startedAt: Date.now(), beforeIds: undefined }]);
    // Best-effort snapshot for resume-after-reload — doesn't block the
    // investigation itself, which starts immediately below regardless.
    insightsService.getInsights(datasetId, userId)
      .then(list => setJobs(js => js.map(j => j.id === id ? { ...j, beforeIds: list.map(i => i.id) } : j)))
      .catch(() => {});
    runJob(datasetId, userId, id, prompt);
    return id;
  }, [runJob, jobs]);

  const cancelJob = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearInterval(t); clearTimeout(t); timers.current.delete(id); }
    stopProgressTicker(id);
    setJobs(js => {
      const job = js.find(j => j.id === id);
      if (job?.status === 'running' && job.prompt.trim()) runningKeys.current.delete(jobKey(job.datasetId, job.prompt));
      return js.filter(j => j.id !== id);
    });
    setSelectedJobId(cur => cur === id ? null : cur);
  }, []);

  const restartJob = useCallback((datasetId: string, id: string) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    setJobs(js => js.map(j => j.id === id ? { ...j, status: 'running', progress: 0, startedAt: Date.now(), errorMessage: undefined, beforeIds: undefined } : j));
    insightsService.getInsights(datasetId, job.userId)
      .then(list => setJobs(js => js.map(j => j.id === id ? { ...j, beforeIds: list.map(i => i.id) } : j)))
      .catch(() => {});
    if (job.prompt.trim()) runningKeys.current.add(jobKey(datasetId, job.prompt));
    runJob(datasetId, job.userId, id, job.prompt);
  }, [jobs, runJob]);

  return (
    <JobsContext.Provider value={{ jobs, selectedJobId, selectJob: setSelectedJobId, startJob, cancelJob, restartJob }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error('useJobs must be used within a JobsProvider');
  return ctx;
}
