/**
 * Inline job strip under the "What should Aspect investigate for you?" hero
 * (design turn 3a) — every job, not just the header's max-2 badges, since
 * this is the dedicated place to see them all rather than opening the
 * overflow popover.
 */
import { useJobs, type Job } from './JobsContext';
import styles from './JobStrip.module.css';

interface Props {
  datasetId: string;
  onOpenInsight: (id: string) => void;
}

export function JobStrip({ datasetId, onOpenInsight }: Props) {
  const { jobs, restartJob, selectJob, cancelJob } = useJobs();
  if (jobs.length === 0) return null;

  const ordered = [...jobs].reverse();

  // Once you've actually opened the result, it doesn't belong in this strip
  // (or the header badges — same underlying jobs list) anymore, or it would
  // just sit there forever.
  const openResult = (job: Job) => {
    const firstId = job.result?.insightIds[0];
    cancelJob(job.id);
    if (firstId) onOpenInsight(firstId);
  };

  return (
    <div className={styles.strip}>
      {ordered.map(job => (
        <JobCard
          key={job.id}
          job={job}
          onOpenResult={() => openResult(job)}
          onRestart={() => restartJob(datasetId, job.id)}
          onOpenSidebar={() => selectJob(job.id)}
        />
      ))}
    </div>
  );
}

function JobCard({ job, onOpenResult, onRestart, onOpenSidebar }: { job: Job; onOpenResult: () => void; onRestart: () => void; onOpenSidebar: () => void }) {
  if (job.status === 'completed') {
    const n = job.result?.findingsCount ?? 1;
    return (
      <div className={styles.card + ' ' + styles.ready} onClick={onOpenResult} role="button" tabIndex={0}>
        <span className={styles.emoji}>🎉</span>
        <div className={styles.body}>
          <div className={styles.title}>Ready: &quot;{job.prompt}&quot;</div>
          <div className={styles.sub}>{n} finding{n === 1 ? '' : 's'} · est. impact {job.result?.combinedImpactLabel}</div>
        </div>
        <button className={styles.viewBtn} onClick={e => { e.stopPropagation(); onOpenResult(); }}>View results</button>
      </div>
    );
  }

  if (job.status === 'error') {
    return (
      <div className={styles.card + ' ' + styles.errored} onClick={onOpenSidebar} role="button" tabIndex={0}>
        <span className={styles.errIcon}>!</span>
        <div className={styles.body}>
          <div className={styles.title}>Investigation failed: &quot;{job.prompt}&quot;</div>
          <div className={styles.sub}>{job.errorMessage || 'Something went wrong.'}</div>
        </div>
        <button className={styles.restartBtn} onClick={e => { e.stopPropagation(); onRestart(); }}>Restart ↻</button>
      </div>
    );
  }

  // The fake ramp caps at 96% within ~8s, but a real investigation runs far
  // longer than that — showing a literal countdown derived from the same 8s
  // window would keep claiming "~1s left" for the next minute. Once it's
  // sitting at the cap, say so honestly instead of a number that stopped
  // meaning anything.
  const nearCap = job.progress >= 90;
  const secondsLeft = Math.max(1, Math.round((100 - job.progress) / 100 * 8));
  return (
    <div className={styles.card + ' ' + styles.running} onClick={onOpenSidebar} role="button" tabIndex={0}>
      <span className={styles.dot} />
      <div className={styles.body}>
        <div className={styles.title}>Investigating: {job.prompt || 'picking a new angle…'}</div>
        <div className={styles.sub}>Running the real plan → query → synthesize pipeline against your data</div>
      </div>
      <div className={styles.progressCol}>
        <div className={styles.track}><div className={styles.fill} style={{ width: `${job.progress}%` }} /></div>
        <div className={styles.progressText}>{job.progress}% · {nearCap ? 'finishing up…' : `~${secondsLeft}s left`}</div>
      </div>
    </div>
  );
}
