import type { InsightReasoningStep } from '../../../types/insights';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './ReasoningTrail.module.css';

export function ReasoningTrail({ steps, onViewSql, onAskFollowUp }: {
  steps: InsightReasoningStep[];
  onViewSql?: () => void;
  onAskFollowUp?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className={styles.card}>
      <div className={styles.title}>{t('intel.detail.howFound')}</div>
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
        <button className={styles.actionBtn} onClick={onViewSql}>{t('intel.detail.viewSql')}</button>
        <button className={styles.actionBtn} onClick={onAskFollowUp}>{t('intel.detail.askFollowUp')}</button>
      </div>
    </div>
  );
}
