import { apiRequest } from './api';

export interface SchedulerJob {
  name: string;
  schedule: string;
  timeZone: string;
  state: 'ENABLED' | 'PAUSED';
  uri: string | null;
  lastAttemptTime: string | null;
  scheduleTime: string | null;
}

export async function getSchedulerJobs(baseURL?: string): Promise<SchedulerJob[]> {
  const data = await apiRequest<{ jobs: SchedulerJob[] }>('/api/admin/scheduler/jobs', { method: 'GET' }, baseURL);
  return data.jobs;
}

export async function updateSchedulerJob(
  name: string,
  updates: { schedule?: string; paused?: boolean },
  baseURL?: string
): Promise<SchedulerJob> {
  const data = await apiRequest<{ job: SchedulerJob }>(
    `/api/admin/scheduler/jobs/${encodeURIComponent(name)}`,
    { method: 'PATCH', body: JSON.stringify(updates) },
    baseURL
  );
  return data.job;
}
