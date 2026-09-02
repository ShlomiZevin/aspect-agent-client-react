/** Header row of job badges — max 2 visible + "+N more" overflow popover (design turn 5a/5b). */
import { useState } from 'react';
import { useJobs } from './JobsContext';
import { JobBadge } from './JobBadge';
import styles from './JobBadge.module.css';

interface Props {
  datasetId: string;
  /** Completed badges say "Review →" and jump straight to the result rather than opening the sidebar. */
  onReviewCompleted: (job: import('./JobsContext').Job) => void;
}

export function JobBadges({ datasetId, onReviewCompleted }: Props) {
  const { jobs, selectJob, restartJob } = useJobs();
  const [overflowOpen, setOverflowOpen] = useState(false);

  if (jobs.length === 0) return null;

  const ordered = [...jobs].reverse();
  const visible = ordered.slice(0, 2);
  const overflow = ordered.slice(2);

  const openJob = (job: import('./JobsContext').Job) => {
    // A task is work, not a report: there is no result behind it to review and
    // no sidebar entry worth opening, so clicking it does nothing. It still
    // shows in the same badges, which is the whole point — an app announces a
    // long operation the way the Intelligence Center already does.
    if (job.kind === 'task') return;
    if (job.status === 'completed') onReviewCompleted(job);
    else selectJob(job.id);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
      {visible.map(job => (
        <JobBadge
          key={job.id}
          job={job}
          onClick={() => openJob(job)}
          onRestart={e => { e.stopPropagation(); restartJob(datasetId, job.id); }}
        />
      ))}

      {overflow.length > 0 && (
        <>
          <button className={styles.overflowBtn} onClick={() => setOverflowOpen(o => !o)}>+{overflow.length} more</button>
          {overflowOpen && (
            <div className={styles.overflowPopover}>
              {overflow.map(job => (
                <JobBadge
                  key={job.id}
                  job={job}
                  onClick={() => { openJob(job); setOverflowOpen(false); }}
                  onRestart={e => { e.stopPropagation(); restartJob(datasetId, job.id); }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
