import type { InsightReasoningStep } from '../../../types/insights';
import styles from './ReasoningTrail.module.css';

export function ReasoningTrail({ steps, onViewSql, onAskFollowUp }: {
  steps: InsightReasoningStep[];
  onViewSql?: () => void;
  onAskFollowUp?: () => void;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.title}>How Aspect found this</div>
      <div>
        {steps.map((step, i) => (
          <div className={styles.step} key={step.title}>
            <div className={styles.railCol}>
              <div className={styles.num}>{i + 1}</div>
              {i < steps.length - 1 && <div className={styles.line} />}
            </div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>{step.title}</div>
              <div className={styles.stepDesc}>{step.description}</div>
            </div>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={onViewSql}>View SQL queries</button>
        <button className={styles.actionBtn} onClick={onAskFollowUp}>Ask a follow-up in chat</button>
      </div>
    </div>
  );
}
