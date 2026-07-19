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
  prompt: string;
  status: JobStatus;
  progress: number;
  startedAt: number;
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
  startJob: (datasetId: string, prompt: string) => string;
  cancelJob: (id: string) => void;
  restartJob: (datasetId: string, id: string) => void;
}

const JobsContext = createContext<JobsContextValue | undefined>(undefined);

const FAKE_DURATION_MS = 8000;
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

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(loadStoredJobs);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>>>(new Map());
  // Separate from `timers` (which holds the resume poll's setTimeout) — the
  // progress-bar ticker keeps running independently while polling, capped
  // at 96%, so a resumed job doesn't sit visibly frozen at whatever % it
  // happened to be at when the page reloaded.
  const progressTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const runJob = useCallback((datasetId: string, id: string, prompt: string) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setJobs(js => js.map(j => {
        if (j.id !== id || j.status !== 'running') return j;
        const pct = Math.min(96, Math.round((Date.now() - startedAt) / FAKE_DURATION_MS * 100));
        return { ...j, progress: pct };
      }));
    }, 150);
    timers.current.set(id, interval);

    insightsService.investigate(datasetId, prompt)
      .then(result => {
        const elapsed = Date.now() - startedAt;
        const wait = Math.max(0, FAKE_DURATION_MS - elapsed);
        setTimeout(() => {
          clearInterval(interval);
          timers.current.delete(id);
          // For an auto-proposed investigation (started with prompt: ''),
          // the server picks the actual angle — result.prompt carries that
          // real prompt back so the badge/review label isn't blank.
          setJobs(js => js.map(j => j.id === id ? { ...j, status: 'completed', progress: 100, result, prompt: result.prompt || j.prompt } : j));
        }, wait);
      })
      .catch(err => {
        clearInterval(interval);
        timers.current.delete(id);
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

  const resumeJob = useCallback((datasetId: string, id: string, beforeIds: string[] | undefined, attempt = 0) => {
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
          const pct = Math.min(96, Math.max(j.progress, Math.round((Date.now() - tickStart) / FAKE_DURATION_MS * 100)));
          return { ...j, progress: pct };
        }));
      }, 150);
      progressTimers.current.set(id, tick);
    }

    insightsService.getInsights(datasetId)
      .then(list => {
        const fresh = list.find(i => !beforeIds.includes(i.id));
        if (fresh) {
          stopProgressTicker(id);
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
          setJobs(js => js.map(j => j.id === id ? { ...j, status: 'error', errorMessage: 'This investigation is taking longer than expected to reappear after reload — check the insights list below, or Restart.' } : j));
          return;
        }
        const t = setTimeout(() => resumeJob(datasetId, id, beforeIds, attempt + 1), RESUME_POLL_MS);
        timers.current.set(id, t);
      })
      .catch(() => {
        if (attempt >= RESUME_MAX_ATTEMPTS) {
          stopProgressTicker(id);
          setJobs(js => js.map(j => j.id === id ? { ...j, status: 'error', errorMessage: 'Lost track of this investigation.' } : j));
          return;
        }
        const t = setTimeout(() => resumeJob(datasetId, id, beforeIds, attempt + 1), RESUME_POLL_MS);
        timers.current.set(id, t);
      });
  }, []);

  // Runs once on mount: any job restored from sessionStorage that was still
  // 'running' when the page went away needs to be reconnected.
  useEffect(() => {
    jobs.forEach(j => {
      if (j.status === 'running') resumeJob(j.datasetId, j.id, j.beforeIds);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startJob = useCallback((datasetId: string, prompt: string) => {
    const id = crypto.randomUUID();
    setJobs(js => [...js, { id, datasetId, prompt, status: 'running', progress: 0, startedAt: Date.now(), beforeIds: undefined }]);
    // Best-effort snapshot for resume-after-reload — doesn't block the
    // investigation itself, which starts immediately below regardless.
    insightsService.getInsights(datasetId)
      .then(list => setJobs(js => js.map(j => j.id === id ? { ...j, beforeIds: list.map(i => i.id) } : j)))
      .catch(() => {});
    runJob(datasetId, id, prompt);
    return id;
  }, [runJob]);

  const cancelJob = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) { clearInterval(t); clearTimeout(t); timers.current.delete(id); }
    stopProgressTicker(id);
    setJobs(js => js.filter(j => j.id !== id));
    setSelectedJobId(cur => cur === id ? null : cur);
  }, []);

  const restartJob = useCallback((datasetId: string, id: string) => {
    setJobs(js => js.map(j => j.id === id ? { ...j, status: 'running', progress: 0, startedAt: Date.now(), errorMessage: undefined, beforeIds: undefined } : j));
    insightsService.getInsights(datasetId)
      .then(list => setJobs(js => js.map(j => j.id === id ? { ...j, beforeIds: list.map(i => i.id) } : j)))
      .catch(() => {});
    const job = jobs.find(j => j.id === id);
    if (job) runJob(datasetId, id, job.prompt);
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
