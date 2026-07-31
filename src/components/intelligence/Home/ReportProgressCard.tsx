/**
 * "Your report is being built right now" card (design turn 10a) — only
 * rendered on Home while a report is running. Shares its 5-step script with
 * the header job sidebar (see jobs/investigationSteps.ts) so both always
 * describe the same steps; this is just the horizontal, always-visible
 * variant instead of an opt-in side panel.
 */
import type { Job } from '../jobs/JobsContext';
import { STEP_SCRIPT, stepStatus, currentStepIndex } from '../jobs/investigationSteps';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './ReportProgressCard.module.css';

interface Props {
  job: Job;
}

export function ReportProgressCard({ job }: Props) {
  const { t } = useLanguage();
  const activeIndex = currentStepIndex(job.progress);
  const nearCap = job.progress >= 90;
  const secondsLeft = Math.max(1, Math.round((100 - job.progress) / 100 * 8));

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.dot} />
        <div className={styles.headBody}>
          <div className={styles.kicker}>{t('intel.progress.building')}</div>
          <div className={styles.title}>{job.prompt || '…'}</div>
        </div>
        <div className={styles.pctCol}>
          <div className={styles.pct}>{job.progress}%</div>
          <div className={styles.eta}>{nearCap ? t('intel.progress.finishing') : `${t('intel.progress.about')} ${secondsLeft}s ${t('intel.progress.left')}`}</div>
        </div>
      </div>

      <div className={styles.track}><div className={styles.fill} style={{ width: `${job.progress}%` }} /></div>

      <div className={styles.steps}>
        {STEP_SCRIPT.map((step, i) => {
          const status = stepStatus(job.progress, i);
          const statusClass = status === 'done' ? styles.stepDone : status === 'active' ? styles.stepActive : styles.stepPending;
          return (
            <div key={step.labelKey} className={`${styles.step} ${statusClass}`}>
              <div className={styles.stepTop}>
                <span className={styles.stepIcon}>{status === 'done' ? '✓' : status === 'active' ? <span className={styles.stepDotSmall} /> : i + 1}</span>
                <span className={styles.stepLabel}>{t(step.labelKey)}</span>
              </div>
              <div className={styles.stepDesc}>{i === activeIndex ? `${t(step.descKey)} — ${t('intel.step.runningNow')}` : t(step.descKey)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
